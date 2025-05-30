import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Response, Request } from 'express';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import { LeetCodeResponse } from '../types';
import 'dotenv/config';

const SHEET_ID = '1hTW1JnpOIWWSr51bJzekJrc5wEUbh0a0y9ijrDdavjw';
const SHEET1_RANGE = 'Sheet1';
const SHEET2_RANGE = 'Sheet2';

const auth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL!,
  key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export const fetchProblemStatusAndGenerateCSV = async (req: Request, res: Response, query: string) => {
  const { problemName } = req.query;
  if (!problemName) {
    return res.status(400).json({ error: 'Missing problemName' });
  }

  try {
    // Step 1: Fetch usernames from Sheet1
    const csvResponse = await fetch(`https://docs.google.com/spreadsheets/d/e/2PACX-1vQhW0WdhfhQkGR3eLXJog9Z8ActeZmVaYtA1Tdl7b1TxKe_daVVQxYSAcAA6q72IdR-muQveHx6EAq0/pub?output=csv`);
    const csvText = await csvResponse.text();
    const records = parse(csvText, { columns: true, skip_empty_lines: true });
    const usernames = records.map((r: any) => r.Username || r.username).filter(Boolean);

    // Step 2: Parallelized LeetCode query
    const BATCH_SIZE = 10;
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const fetchUserStatus = async (username: string) => {
      try {
        const leetRes = await fetch('https://leetcode.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Referer: 'https://leetcode.com',
          },
          body: JSON.stringify({
            query,
            variables: { username, limit: 50 },
          }),
        });

        const data = await leetRes.json() as LeetCodeResponse;
        const recent = data.data?.recentAcSubmissionList || [];
        const solved = recent.some(
          (s: any) => s?.titleSlug?.toLowerCase() === (problemName as string).toLowerCase()
        );
        return { username, solved };
      } catch (err) {
        console.warn(`Failed to fetch for ${username}`, err);
        return { username, solved: false };
      }
    };

    const results: { username: string; solved: boolean }[] = [];
    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const batch = usernames.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fetchUserStatus));
      results.push(...batchResults);
      await delay(100); // to avoid getting rate limited
    }

    // Step 3: Update Sheet1
    const updatedRecords = records.map((row: any) => {
      const userResult = results.find((r) =>
        r.username.toLowerCase() === (row.Username || row.username)?.toLowerCase()
      );
      return {
        ...row,
        [problemName as string]: userResult?.solved ? 'Solved' : 'Not Solved',
      };
    });

    const headers = Object.keys(updatedRecords[0]);
    const values = [headers, ...updatedRecords.map(Object.values)];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: SHEET1_RANGE,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    // Step 4: Get Sheet2 username-room mapping
    const sheet2Res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET2_RANGE,
    });

    const sheet2Rows = sheet2Res.data.values || [];
    const [sheet2Headers, ...sheet2Data] = sheet2Rows;
    const roomIndex = sheet2Headers.indexOf('Room');
    const usernameIndex = sheet2Headers.indexOf('Username');

    const userRoomMap: Record<string, string> = {};
    sheet2Data.forEach((row) => {
      const username = row[usernameIndex];
      const room = row[roomIndex];
      if (username && room) {
        userRoomMap[username.toLowerCase()] = room;
      }
    });

    // Step 5: Compute stats per room
    const roomProblemStats: Record<string, Record<string, { solved: number; total: number }>> = {};

    for (const row of updatedRecords) {
      const username = (row.Username || row.username || '').toLowerCase();
      const room = userRoomMap[username];
      if (!room) continue;

      Object.entries(row).forEach(([key, value]) => {
        const keyLower = key.toLowerCase();
        if (['username', 'name', 'room'].includes(keyLower)) return;

        roomProblemStats[room] ??= {};
        roomProblemStats[room][key] ??= { solved: 0, total: 0 };

        roomProblemStats[room][key].total += 1;
        if ((value as string).toLowerCase() === 'solved') {
          roomProblemStats[room][key].solved += 1;
        }
      });
    }

    // Step 6: Build matrix
    const allProblems = new Set<string>();
    Object.values(roomProblemStats).forEach(stats =>
      Object.keys(stats).forEach(p => allProblems.add(p))
    );

    const problemList = Array.from(allProblems);
    const rows: string[][] = [];

    for (const room of Object.keys(roomProblemStats)) {
      const row: string[] = [];
      for (const problem of problemList) {
        const stats = roomProblemStats[room][problem];
        if (stats) {
          const ratio = (stats.solved * 100 / stats.total).toFixed(2) + '%';
          row.push(ratio);
        } else {
          row.push('N/A');
        }
      }
      rows.push(row);
    }

    // Step 7: Upload to Sheet2
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet2!E1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [problemList, ...rows],
      },
    });

    return res.json({ success: true, updated: updatedRecords.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update sheet' });
  }
};

export default fetchProblemStatusAndGenerateCSV;

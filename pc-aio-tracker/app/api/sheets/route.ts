import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sheetName, username, password } = body;

    // --- 1. SECURE BACKEND LOGIN (Menggunakan Environment Variables) ---
    if (action === 'login') {
      const validUser = process.env.ADMIN_USERNAME || "admin";
      const validPass = process.env.ADMIN_PASSWORD || "admin123";
      console.log("DEBUG LOGIN - Masuk:", { username, sentPassLength: password?.length });
      console.log("DEBUG LOGIN - Target Env:", { validUser, hasPass: !!process.env.ADMIN_PASSWORD });
      if (username === validUser && password === validPass) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false, error: "Incorrect username or password." });
      }
    }

    // --- 2. DATA ENGINE ---
    if (action === 'getData') {
      const allowedSheets = [
        "Media API",
        "Commerce",
        "Creative Raw",
        "Media Signal",
        "CIR DAILY",
        "PID CATEGORY",
        "PID SALES",
        "PID CID",
        "Adjustment Logs"
      ];
      
      if (!allowedSheets.includes(sheetName)) {
        return NextResponse.json({ error: `Unauthorized or invalid sheet name: ${sheetName}` }, { status: 400 });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID, 
        range: `${sheetName}!A1:ZZ`, // Membaca sampai kolom ZZ agar tidak terpotong
      });

      const data = response.data.values;
      if (!data || data.length === 0) {
        return NextResponse.json({ success: true, headers: [], data: [], sheetName });
      }

      if (data.length === 1) {
        // Hanya header tanpa baris data
        const headers = data[0].map(h => String(h).trim());
        return NextResponse.json({ success: true, headers, data: [], sheetName });
      }

      // Mengubah format Array menjadi Array of Objects
      const headers = data[0].map(h => String(h).trim());
      const formattedData = data.slice(1).map(row => {
        let obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? row[index] : "";
        });
        return obj;
      });

      return NextResponse.json({ success: true, headers, data: formattedData, sheetName });
    }

    // --- 3. ADD ADJUSTMENT LOG ---
    if (action === 'addAdjustment') {
      const { date, pid, skuName, metric, adjustment, userName } = body;
      if (!pid || !adjustment) {
        return NextResponse.json({ error: "Missing required fields (pid or adjustment)." }, { status: 400 });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const id = `ADJ-${Date.now()}`;
      const now = new Date().toISOString();
      const newRow = [
        id,
        date || "",
        pid,
        skuName || "",
        metric || "General",
        adjustment,
        "Pending",
        userName || "User",
        now,
        "",
        ""
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Adjustment Logs!A:K',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [newRow],
        },
      });

      return NextResponse.json({
        success: true,
        adjustment: {
          id,
          date: date || "",
          pid,
          skuName: skuName || "",
          metric: metric || "General",
          adjustment,
          status: "Pending",
          createdBy: userName || "User",
          createdAt: now,
          updatedAt: "",
          updatedBy: ""
        }
      });
    }

    // --- 4. UPDATE ADJUSTMENT STATUS ---
    if (action === 'updateAdjustmentStatus') {
      const { id, status, userName } = body;
      if (!id || !status) {
        return NextResponse.json({ error: "Missing id or status." }, { status: 400 });
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Adjustment Logs!A:K',
      });
      const rows = getRes.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === id);
      if (rowIndex === -1) {
        return NextResponse.json({ error: `Adjustment with ID ${id} not found.` }, { status: 404 });
      }

      const sheetRowNum = rowIndex + 1;
      const now = new Date().toISOString();

      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `Adjustment Logs!G${sheetRowNum}:K${sheetRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            status,
            rows[rowIndex][7] || "", // Created By
            rows[rowIndex][8] || "", // Created At
            now,                     // Updated At
            userName || "User"       // Updated By
          ]],
        },
      });

      return NextResponse.json({
        success: true,
        id,
        status,
        updatedAt: now,
        updatedBy: userName || "User"
      });
    }

    return NextResponse.json({ error: "Invalid action request." }, { status: 400 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
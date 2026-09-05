import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sheetName, username, password } = body;

    // --- 1. SECURE BACKEND LOGIN (Menggantikan verifyLogin) ---
    if (action === 'login') {
      const validUser = "admin";
      const validPass = "admin123";
      
      if (username === validUser && password === validPass) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false, error: "Incorrect username or password." });
      }
    }

    // --- 2. DATA ENGINE (Menggantikan getDashboardData) ---
    if (action === 'getData') {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        // Pastikan SPREADSHEET_ID Anda ('1SmrFm...') ada di dalam file .env.local
        spreadsheetId: process.env.SPREADSHEET_ID, 
        range: `${sheetName}!A1:Z`,
      });

      const data = response.data.values;
      if (!data || data.length < 2) {
        return NextResponse.json({ error: `Not enough data in sheet: ${sheetName}` }, { status: 400 });
      }

      // Mengubah format Array menjadi Array of Objects (seperti di code.gs)
      const headers = data[0].map(h => String(h).trim());
      const formattedData = data.slice(1).map(row => {
        let obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      return NextResponse.json({ success: true, headers, data: formattedData, sheetName });
    }

    return NextResponse.json({ error: "Invalid action request." }, { status: 400 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
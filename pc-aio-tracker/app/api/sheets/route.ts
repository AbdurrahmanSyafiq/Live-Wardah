import { google } from "googleapis";
import { NextResponse } from "next/server";
import { HOME_MONTH_SHEETS } from "@/lib/homeData";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sheetName, username, password } = body;

    // --- 1. SECURE BACKEND LOGIN (Menggunakan Environment Variables) ---
    if (action === "login") {
      const validUser = process.env.ADMIN_USERNAME || "admin";
      const validPass = process.env.ADMIN_PASSWORD || "admin123";
      console.log("DEBUG LOGIN - Masuk:", {
        username,
        sentPassLength: password?.length,
      });
      console.log("DEBUG LOGIN - Target Env:", {
        validUser,
        hasPass: !!process.env.ADMIN_PASSWORD,
      });
      if (username === validUser && password === validPass) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({
          success: false,
          error: "Incorrect username or password.",
        });
      }
    }

    // --- 2. DATA ENGINE ---
    if (action === "getData") {
      const allowedSheets = [
        "Media API",
        "Commerce",
        "Creative Raw",
        "Media Signal",
        "CIR DAILY",
        ...Object.values(HOME_MONTH_SHEETS),
      ]; // + sheet bulanan Home (Wardah Sep, Wardah Oct)

      if (!allowedSheets.includes(sheetName)) {
        return NextResponse.json(
          { error: `Unauthorized or invalid sheet name: ${sheetName}` },
          { status: 400 },
        );
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(
            /\\n/g,
            "\n",
          ).replace(/"/g, ""),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${sheetName}!A1:ZZ`, // Membaca sampai kolom ZZ agar tidak terpotong
      });

      const data = response.data.values;
      if (!data || data.length < 2) {
        return NextResponse.json(
          { error: `Not enough data in sheet: ${sheetName}` },
          { status: 400 },
        );
      }

      // Mengubah format Array menjadi Array of Objects
      const headers = data[0].map((h) => String(h).trim());
      const formattedData = data.slice(1).map((row) => {
        let obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? row[index] : "";
        });
        return obj;
      });

      return NextResponse.json({
        success: true,
        headers,
        data: formattedData,
        sheetName,
      });
    }

    return NextResponse.json(
      { error: "Invalid action request." },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

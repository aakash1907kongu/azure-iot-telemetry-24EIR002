// Vercel Serverless Function for /api/latest
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const rawMessage = "one_credit_course_project";
  const asciiValues = Array.from(rawMessage).map((c) => c.charCodeAt(0));

  res.status(200).json({
    student_name: "Aakash K",
    roll_no: "24EIR002",
    department: "Electronics & Instrumentation Engineering",
    college: "Kongu Engineering College",
    status: "connected",
    raw_data: rawMessage,
    ascii_values: asciiValues,
    ascii_string: asciiValues.join(", "),
    converted_string: rawMessage,
    message: rawMessage,
    timestamp: new Date().toISOString(),
    partition: "1",
    service: "vercel_azure_web_serverless",
  });
}

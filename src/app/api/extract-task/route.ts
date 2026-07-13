import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readSettings } from '@/utils/settings';
import { format } from 'date-fns';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const settings = await readSettings();
    if (!settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured in Settings' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    // Use gemini-1.5-pro or gemini-1.5-flash for complex parsing
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const now = new Date();
    const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm:ss");

    const prompt = `
Bạn là một trợ lý ảo giúp bóc tách thông tin công việc từ văn bản tự do.
Văn bản đầu vào có thể chứa một hoặc NHIỀU công việc.
Văn bản đầu vào: "${text}"

Thời gian hiện tại là: ${formattedNow}

Hãy phân tích và trả về CHỈ MỘT MẢNG JSON (không có markdown \`\`\`json) chứa danh sách các công việc. Định dạng chính xác của mảng như sau, không có bất kỳ text nào khác:
[
  {
    "createdAt": "thời gian hiện tại hoặc được nhắc tới (ISO format YYYY-MM-DDTHH:mm:ss)",
    "title": "Tiêu đề công việc ngắn gọn (tối đa 50 ký tự)",
    "details": "Chi tiết công việc",
    "assignee": "Tên người được giao việc nếu có, nếu không thì để trống",
    "startDate": "Ngày bắt đầu nếu có (ISO format YYYY-MM-DDTHH:mm:ss), nếu không để null",
    "dueDate": "Hạn chót nếu có (ISO format YYYY-MM-DDTHH:mm:ss), nếu không để null",
    "notes": "Các ghi chú liên quan khác"
  }
]
Lưu ý: Nếu người dùng dùng các từ như "ngày mai", "tuần sau", hãy dựa vào thời gian hiện tại để tính toán ngày cho startDate hoặc dueDate. Đảm bảo trả về MẢNG [] kể cả khi chỉ có 1 công việc.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text().trim();
    
    // Remove markdown code blocks if the model still outputs them
    if (jsonText.startsWith('\`\`\`json')) {
      jsonText = jsonText.substring(7);
    }
    if (jsonText.startsWith('\`\`\`')) {
      jsonText = jsonText.substring(3);
    }
    if (jsonText.endsWith('\`\`\`')) {
      jsonText = jsonText.substring(0, jsonText.length - 3);
    }

    const taskData = JSON.parse(jsonText.trim());
    return NextResponse.json(taskData);
  } catch (error: unknown) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to extract task data' }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

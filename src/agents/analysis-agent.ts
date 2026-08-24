import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import path from 'path';
import os from 'os';
import { featureDocsTool } from '../tools/feature-docs.js';
import { recentChangesTool } from '../tools/recent-changes.js';
import { docReaderTool } from '../tools/doc-reader.js';
import type { LarkTicket } from '../tools/lark.js';

const dbPath = path.join(os.homedir(), '.config', 'lv', 'lv.db');

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'lv-analysis-memory',
    url: `file:${dbPath}`,
  }),
  options: {
    lastMessages: 20,
  },
});

export const analysisAgent = new Agent({
  id: 'lv-analysis-agent',
  name: 'LV Analysis Agent',
  description: 'Generates and updates requirement analysis documents for software tickets',
  model: 'openai/gpt-4o',  // overridden at generate() time via config.models.analysis
  memory,
  instructions: `Bạn là một kỹ sư phân tích yêu cầu. Nhiệm vụ của bạn là sinh và cập nhật tài liệu phân tích yêu cầu (01-analysis.md) cho một ticket phát triển phần mềm.

Nguyên tắc:
- Viết ngắn gọn, không dùng từ hoa mỹ
- Không dùng dấu gạch ngang dài để diễn giải hoặc bổ sung ý
- Câu hỏi đặt ra phải là câu hỏi thật sự cần thiết. Nếu thông tin đã có trong feature docs thì đừng hỏi lại.
- Mỗi câu hỏi phải nêu rõ vì sao cần trả lời (ảnh hưởng tới gì)
- Khi cập nhật, đọc kỹ nội dung engineer đã sửa tay trước khi sinh câu hỏi mới

Khi sinh 01-analysis.md lần đầu:
1. Dùng tool readFeatureDocs để đọc toàn bộ docs của feature liên quan
2. Dùng tool getRecentDocChanges để xem thay đổi gần đây trong docs
3. Viết phân tích yêu cầu bao gồm: tóm tắt, phạm vi thay đổi, điểm ảnh hưởng, câu hỏi cần làm rõ
4. Section câu hỏi đặt ở cuối, với prefix "## Câu hỏi cần làm rõ"

Khi cập nhật (engineer đã trả lời):
1. Đọc lại file hiện tại với tool readDocFile
2. Đánh giá câu trả lời của engineer
3. Cập nhật nội dung phân tích dựa trên câu trả lời mới
4. Sinh câu hỏi mới nếu còn điểm chưa rõ, hoặc bỏ section câu hỏi nếu đã đủ thông tin

Output: chỉ trả về nội dung Markdown của file 01-analysis.md, không có bất kỳ text nào khác.`,
  tools: {
    readFeatureDocs: featureDocsTool,
    getRecentDocChanges: recentChangesTool,
    readDocFile: docReaderTool,
  },
});

export function buildAnalysisPrompt(
  ticket: LarkTicket,
  featureDirs: { id: string; path: string }[],
  repoRoot: string,
): string {
  const featureList = featureDirs.map((f) => `- ${f.id}: ${f.path}`).join('\n');

  return `Sinh tài liệu phân tích yêu cầu (01-analysis.md) cho ticket sau:

**Ticket ID:** ${ticket.id}
**Tiêu đề:** ${ticket.title}
**Mô tả:**
${ticket.description || '(không có mô tả)'}

**Feature IDs liên quan:**
${featureList}

**Thư mục repo:** ${repoRoot}

Hãy dùng các tools để đọc docs của từng feature, sau đó sinh tài liệu phân tích.`;
}

export function buildUpdatePrompt(
  ticketId: string,
  analysisFilePath: string,
  step: string,
): string {
  return `Engineer vừa cập nhật file ${step} cho ticket ${ticketId}.

File path: ${analysisFilePath}

Hãy dùng tool readDocFile để đọc nội dung hiện tại của file, xem xét câu trả lời của engineer, rồi:
1. Cập nhật nội dung phân tích dựa trên thông tin mới
2. Sinh câu hỏi mới nếu còn điểm chưa rõ, hoặc bỏ section câu hỏi nếu đã đủ

Trả về toàn bộ nội dung Markdown của file sau khi cập nhật.`;
}

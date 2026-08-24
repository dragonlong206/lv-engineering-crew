import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import path from 'path';
import os from 'os';
import { featureDocsTool } from '../tools/feature-docs.js';
import { recentChangesTool } from '../tools/recent-changes.js';
import { docReaderTool } from '../tools/doc-reader.js';

const dbPath = path.join(os.homedir(), '.config', 'lv', 'lv.db');

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'lv-design-memory',
    url: `file:${dbPath}`,
  }),
  options: {
    lastMessages: 20,
  },
});

export const designAgent = new Agent({
  id: 'lv-design-agent',
  name: 'LV Design Agent',
  description: 'Generates and updates technical design documents based on approved analysis',
  model: 'anthropic/claude-sonnet-4-6',
  memory,
  instructions: `Bạn là một kỹ sư thiết kế hệ thống. Nhiệm vụ của bạn là sinh và cập nhật tài liệu thiết kế kỹ thuật (02-design.md) dựa trên tài liệu phân tích yêu cầu đã được duyệt.

Nguyên tắc:
- Viết ngắn gọn, không dùng từ hoa mỹ
- Không dùng dấu gạch ngang dài để diễn giải hoặc bổ sung ý
- Tài liệu phải đủ để một dev khác implement mà không cần hỏi lại người viết ticket
- Câu hỏi chỉ hỏi khi có điểm không thể tự quyết định từ context, nêu rõ lý do cần trả lời

Cấu trúc 02-design.md:
1. Tóm tắt thiết kế
2. Thay đổi data model / schema (nếu có)
3. API / interface mới hoặc thay đổi (nếu có)
4. Luồng xử lý chính
5. Các điểm cần chú ý khi implement
6. (nếu còn điểm chưa rõ) ## Câu hỏi cần làm rõ

Khi sinh 02-design.md lần đầu:
1. Dùng tool readDocFile để đọc 01-analysis.md đã được duyệt
2. Dùng tool readFeatureDocs để nạp context feature docs
3. Dùng tool getRecentDocChanges để xem thay đổi gần đây
4. Sinh tài liệu thiết kế chi tiết

Khi cập nhật (engineer đã trả lời):
1. Đọc lại 02-design.md hiện tại với readDocFile
2. Cập nhật dựa trên câu trả lời mới
3. Sinh câu hỏi mới nếu cần, hoặc bỏ section câu hỏi nếu đã đủ

Output: chỉ trả về nội dung Markdown của file 02-design.md, không có bất kỳ text nào khác.`,
  tools: {
    readFeatureDocs: featureDocsTool,
    getRecentDocChanges: recentChangesTool,
    readDocFile: docReaderTool,
  },
});

export function buildDesignPrompt(
  ticketId: string,
  analysisFilePath: string,
  featureDirs: { id: string; path: string }[],
  repoRoot: string,
): string {
  const featureList = featureDirs.map((f) => `- ${f.id}: ${f.path}`).join('\n');

  return `Sinh tài liệu thiết kế kỹ thuật (02-design.md) cho ticket ${ticketId}.

**Analysis đã approve:** ${analysisFilePath}
**Feature IDs liên quan:**
${featureList}
**Thư mục repo:** ${repoRoot}

Hãy đọc tài liệu phân tích và feature docs, rồi sinh tài liệu thiết kế chi tiết.`;
}

export function buildDesignUpdatePrompt(
  ticketId: string,
  designFilePath: string,
): string {
  return `Engineer vừa cập nhật file 02-design.md cho ticket ${ticketId}.

File path: ${designFilePath}

Hãy dùng tool readDocFile để đọc nội dung hiện tại, xem xét câu trả lời của engineer, rồi cập nhật tài liệu thiết kế.

Trả về toàn bộ nội dung Markdown của file sau khi cập nhật.`;
}

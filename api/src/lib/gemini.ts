import { GoogleGenAI } from "@google/genai";

const QUESTION_PROMPT = (files: string[]) =>
  `
あなたはエンジニアの振り返りをサポートするコーチです。
GitHubのpushで変更されたファイル一覧をもとに、エンジニアに投げかける振り返り質問を1つ生成してください。

## 変更ファイル
${JSON.stringify(files)}

## ルール
- 質問は日本語で、1文以内
- 「何に詰まっていましたか？どう解決しましたか？」のような具体的な学びを引き出す質問にする
- ファイル名から文脈を読み取り、関連する内容に触れる
- カジュアルで親しみやすいトーンで

質問文のみを出力してください（前置きや説明は不要）。
`.trim();

const FALLBACK_QUESTION = "今日のコードで一番詰まったところはどこでしたか？";

export async function generateQuestion(
  apiKey: string,
  changedFiles: string[]
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: QUESTION_PROMPT(changedFiles)
    });
    return response.text ?? FALLBACK_QUESTION;
  } catch (err) {
    console.error("Gemini API error:", err);
    return FALLBACK_QUESTION;
  }
}

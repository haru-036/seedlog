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

const EPISODE_PROMPT = (logs: string[], userPrompt: string) =>
  `
あなたはエンジニアの成長を記録・整理するコーチです。
以下のエンジニアのログ（学び・詰まったこと・解決したこと）をもとに、ユーザーのリクエストに答えてください。

## ログ一覧
${JSON.stringify(logs)}

## ユーザーのリクエスト
${userPrompt}

## ルール
- 日本語で回答する
- ログの内容を具体的に引用・整理する
- エンジニアの成長や学びを肯定的にまとめる
- 箇条書きや見出しを活用して読みやすく整形する

回答のみを出力してください（前置きや説明は不要）。
`.trim();

const FALLBACK_EPISODE = "ログの要約を生成できませんでした。しばらく後にもう一度お試しください。";

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

export async function generateEpisode(
  apiKey: string,
  logContents: string[],
  userPrompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: EPISODE_PROMPT(logContents, userPrompt)
    });
    return response.text ?? FALLBACK_EPISODE;
  } catch (err) {
    console.error("Gemini API error (episode):", err);
    return FALLBACK_EPISODE;
  }
}

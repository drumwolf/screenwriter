import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();

const HEADING_FALLBACK = "UNTITLED SCENE";
const TITLE_FALLBACK = "Untitled";

export interface SceneMeta {
  heading: string;
  title: string;
}

export async function generateSceneMeta(actionContext: string): Promise<SceneMeta> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 60,
      system:
        "Given a description of what happens in a screenplay scene, reply with " +
        "exactly two lines and nothing else:\n" +
        "HEADING: a standard screenplay slugline, e.g. INT. LOCATION - TIME OF DAY\n" +
        "TITLE: a short, human-readable label for the scene (5-8 words), the kind " +
        "a writer would use to find this scene in a list — naming the characters " +
        "and what's happening, not the location/time format.",
      messages: [{ role: "user", content: actionContext }],
    });

    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    const headingMatch = text.match(/HEADING:\s*(.+)/i);
    const titleMatch = text.match(/TITLE:\s*(.+)/i);

    return {
      heading: headingMatch?.[1]?.trim() || HEADING_FALLBACK,
      title: titleMatch?.[1]?.trim() || TITLE_FALLBACK,
    };
  } catch {
    return { heading: HEADING_FALLBACK, title: TITLE_FALLBACK };
  }
}

export interface SceneCharacter {
  name: string;
  note: string;
  entries: string[];
}

function formatCharacters(characters: SceneCharacter[]): string {
  if (characters.length === 0) return "";

  const blocks = characters.map((character) => {
    const lines = [`${character.name}${character.note ? ` — ${character.note}` : ""}`];
    for (const entry of character.entries) {
      lines.push(`  - ${entry}`);
    }
    return lines.join("\n");
  });

  return (
    "\n\nCHARACTERS IN THIS SCENE (use these exact names; stay consistent with " +
    "these established details — they take priority over anything you'd " +
    "otherwise assume about the character):\n" +
    blocks.join("\n\n")
  );
}

export async function draftScene(params: {
  heading: string;
  actionContext: string;
  subtext: string;
  characters?: SceneCharacter[];
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system:
      "You draft screenplay scenes: action lines and dialogue in standard " +
      "screenplay format (character names in caps above their lines). You're " +
      "given a scene heading, what physically happens (action/context), the " +
      "subtext — what's really going on underneath, unspoken — and, when " +
      "available, established details about the characters in the scene. " +
      "Write only the scene itself, nothing else — no preamble, no notes.",
    messages: [
      {
        role: "user",
        content:
          `HEADING: ${params.heading}\n\n` +
          `ACTION/CONTEXT: ${params.actionContext}\n\n` +
          `SUBTEXT: ${params.subtext}` +
          formatCharacters(params.characters ?? []),
      },
    ],
  });

  return response.content.find((block) => block.type === "text")?.text?.trim() ?? "";
}

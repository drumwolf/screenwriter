import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const anthropic = new Anthropic();

export async function checkClaudeHealth(): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 32,
    messages: [
      { role: "user", content: "Reply with just the word: ok" },
    ],
  });

  return response.content.find((block) => block.type === "text")?.text?.trim() ?? "";
}

const HEADING_FALLBACK = "UNTITLED SCENE";
const TITLE_FALLBACK = "Untitled";

const SceneMetaSchema = z.object({
  heading: z
    .string()
    .describe("A standard screenplay slugline, e.g. INT. LOCATION - TIME OF DAY"),
  title: z
    .string()
    .describe(
      "A short, human-readable label for the scene (5-8 words), the kind a writer " +
        "would use to find this scene in a list — naming the characters and what's " +
        "happening, not the location/time format.",
    ),
});

export type SceneMeta = z.infer<typeof SceneMetaSchema>;

export async function generateSceneMeta(actionContext: string): Promise<SceneMeta> {
  try {
    const response = await anthropic.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system:
        "Given a description of what happens in a screenplay scene, or the " +
        "already-written scene itself, give it a slugline heading and a short " +
        "title. If the scene already has a slugline, use that as the heading.",
      messages: [{ role: "user", content: actionContext }],
      output_config: { format: zodOutputFormat(SceneMetaSchema) },
    });

    const meta = response.parsed_output;
    if (!meta) {
      console.error("generateSceneMeta: no parsed output, stop_reason:", response.stop_reason);
    }

    return {
      heading: meta?.heading.trim() || HEADING_FALLBACK,
      title: meta?.title.trim() || TITLE_FALLBACK,
    };
  } catch (err) {
    console.error("generateSceneMeta: API call failed:", err);
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

export interface EarlierScene {
  heading: string;
  title: string;
  content: string;
  isDraft: boolean;
  writtenByUser: boolean;
}

function formatEarlierScenes(scenes: EarlierScene[]): string {
  if (scenes.length === 0) return "";

  const blocks = scenes.map((scene, index) => {
    const kind = scene.writtenByUser
      ? "scene written by the screenwriter"
      : scene.isDraft
        ? "drafted scene"
        : "planned premise, not yet drafted";
    return `${index + 1}. ${scene.title} (${scene.heading}) — ${kind}:\n${scene.content}`;
  });

  return (
    "\n\nEARLIER SCENES IN THIS SCRIPT, IN ORDER (for continuity — stay consistent " +
    "with what has already happened; don't re-explain or repeat things already " +
    "established here):\n" +
    blocks.join("\n\n")
  );
}

export interface StyleReferenceScene {
  heading: string;
  title: string;
  content: string;
}

function formatLaterUserScenes(scenes: StyleReferenceScene[]): string {
  if (scenes.length === 0) return "";

  const blocks = scenes.map((scene) => `${scene.title} (${scene.heading}):\n${scene.content}`);

  return (
    "\n\nSCENES WRITTEN BY THE SCREENWRITER, LATER IN THE SCRIPT (style reference " +
    "only — these haven't happened yet at this point in the story):\n" +
    blocks.join("\n\n")
  );
}

// Testing showed that an example of the writer's own dialogue improves drafts
// far more than describing what natural dialogue sounds like, so scenes the
// writer wrote themselves are offered as the voice to match.
const WRITER_STYLE_INSTRUCTION =
  "\n\nSome scenes in this script were written by the screenwriter themselves — " +
  "they're marked \"written by the screenwriter\" among the earlier scenes, or " +
  "listed separately if they come later in the story. Treat them as the voice to " +
  "match: how these people talk — the rhythm, the plainness, the register, how the " +
  "teasing works. Don't reuse their lines or jokes, and don't refer to events from " +
  "scenes that come later in the story.";

export async function draftScene(params: {
  heading: string;
  actionContext: string;
  subtext: string;
  characters?: SceneCharacter[];
  earlierScenes?: EarlierScene[];
  laterUserScenes?: StyleReferenceScene[];
}): Promise<string> {
  const earlierScenes = params.earlierScenes ?? [];
  const laterUserScenes = params.laterUserScenes ?? [];
  const hasWriterScenes =
    laterUserScenes.length > 0 || earlierScenes.some((scene) => scene.writtenByUser);

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "You draft screenplay scenes: action lines and dialogue in standard " +
      "screenplay format (character names in caps above their lines). You're " +
      "given a scene heading, what physically happens (action/context), the " +
      "subtext — what's really going on underneath, unspoken — and, when " +
      "available, established details about the characters in the scene and " +
      "the earlier scenes in the script. Write only the scene itself, nothing " +
      "else — no preamble, no notes." +
      (hasWriterScenes ? WRITER_STYLE_INSTRUCTION : ""),
    messages: [
      {
        role: "user",
        content:
          `HEADING: ${params.heading}\n\n` +
          `ACTION/CONTEXT: ${params.actionContext}\n\n` +
          `SUBTEXT: ${params.subtext}` +
          formatCharacters(params.characters ?? []) +
          formatEarlierScenes(earlierScenes) +
          formatLaterUserScenes(laterUserScenes),
      },
    ],
  });

  return response.content.find((block) => block.type === "text")?.text?.trim() ?? "";
}

const ConsistencyIssueSchema = z.object({
  character: z.string(),
  detail: z
    .string()
    .describe("The established detail text, quoted verbatim from the list you were given."),
  explanation: z
    .string()
    .describe(
      "Describes the contradiction and ends by asking the writer whether it's " +
        "intentional or a slip.",
    ),
});

const ConsistencyResultSchema = z.object({
  issues: z
    .array(ConsistencyIssueSchema)
    .describe("Every direct contradiction found; an empty array if there are none."),
});

export type ConsistencyIssue = z.infer<typeof ConsistencyIssueSchema>;

export async function checkConsistency(params: {
  draft: string;
  characters: SceneCharacter[];
}): Promise<ConsistencyIssue[]> {
  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "You check a drafted screenplay scene for contradictions against specific " +
      "established character details. You're given the scene's draft and, for each " +
      "character in it, their name and a list of specific established details about " +
      "them. Flag only direct contradictions of one of those specific listed details — " +
      "not generic concerns, not things merely absent from the list.",
    messages: [
      {
        role: "user",
        content: `DRAFT:\n${params.draft}` + formatCharacters(params.characters),
      },
    ],
    output_config: { format: zodOutputFormat(ConsistencyResultSchema) },
  });

  // Throw rather than return [] so a failed check can't be mistaken for
  // "no inconsistencies found" — the route turns this into a 502.
  if (!response.parsed_output) {
    throw new Error(`consistency check returned no result (stop_reason: ${response.stop_reason})`);
  }

  return response.parsed_output.issues;
}

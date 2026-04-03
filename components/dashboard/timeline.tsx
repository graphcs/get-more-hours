import type { Document } from "@/types";

interface TimelineProps {
  documents: Document[];
  caseCreatedAt: string;
}

interface TimelineEntry {
  date: string;
  text: string;
  done: boolean;
}

function deriveTimeline(
  documents: Document[],
  caseCreatedAt: string
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  entries.push({
    date: fmt(caseCreatedAt),
    text: "Intake completed",
    done: true,
  });

  const requestLetter = documents.find(
    (d) => d.type === "generated" && d.name.includes("Request for Increase")
  );
  if (requestLetter) {
    entries.push({
      date: fmt(requestLetter.created_at),
      text: "Request letter generated",
      done: true,
    });
  }

  const lomnTemplate = documents.find(
    (d) => d.type === "generated" && d.name.includes("LOMN")
  );
  if (lomnTemplate) {
    entries.push({
      date: fmt(lomnTemplate.created_at),
      text: "LOMN template generated",
      done: true,
    });
  }

  const uploadedDocs = documents.filter((d) => d.type === "uploaded");
  uploadedDocs.forEach((d) => {
    entries.push({
      date: fmt(d.created_at),
      text: `${d.name} uploaded`,
      done: true,
    });
  });

  // Future steps
  if (!uploadedDocs.some((d) => d.name.toLowerCase().includes("lomn"))) {
    entries.push({ date: "Pending", text: "Upload signed LOMN", done: false });
  }

  entries.push({
    date: "—",
    text: "Finalize & submit to MLTC",
    done: false,
  });

  entries.push({
    date: "—",
    text: "Await MLTC determination (2–4 wks)",
    done: false,
  });

  return entries;
}

export function Timeline({ documents, caseCreatedAt }: TimelineProps) {
  const entries = deriveTimeline(documents, caseCreatedAt);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-[15px] font-semibold text-foreground mb-3.5">
        Timeline
      </h3>
      <div className="relative pl-5">
        <div className="absolute left-[4.5px] top-1 bottom-1 w-0.5 bg-gray-200" />
        {entries.map((t, i) => (
          <div
            key={i}
            className={`relative ${i < entries.length - 1 ? "mb-3.5" : ""}`}
          >
            <div
              className={`w-[11px] h-[11px] rounded-full absolute -left-5 top-[3px] border-2 ${
                t.done
                  ? "bg-emerald-600 border-emerald-200"
                  : "bg-gray-300 border-gray-200"
              }`}
            />
            <div
              className={`text-[10px] font-semibold mb-0.5 ${
                t.done ? "text-gray-500" : "text-gray-400"
              }`}
            >
              {t.date}
            </div>
            <div
              className={`text-xs ${
                t.done ? "text-foreground" : "text-gray-400 italic"
              }`}
            >
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

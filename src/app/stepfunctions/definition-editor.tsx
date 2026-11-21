"use client";

import { useState } from "react";
import { AslGraph } from "./graph";

/** JSON definition editor with a live graph preview. */
export function DefinitionEditor({ name, initial }: { name: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <textarea
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={26}
        spellCheck={false}
        className="w-full rounded-lg border border-control-border bg-editor p-3 font-mono text-[13px] leading-5 focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
      />
      <div className="max-h-[560px] overflow-auto rounded-lg border border-line bg-code p-3">
        <AslGraph definition={value} />
      </div>
    </div>
  );
}

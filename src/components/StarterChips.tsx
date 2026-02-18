'use client';

interface Props {
  chips: string[];
  onSelect: (chip: string) => void;
}

export default function StarterChips({ chips, onSelect }: Props) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="px-4 py-2 bg-cinema-surface border border-cinema-border rounded-full text-sm text-cinema-muted hover:text-white hover:border-cinema-accent/50 hover:bg-cinema-accent/5 transition-all text-left"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

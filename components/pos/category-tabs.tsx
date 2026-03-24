type CategoryTabsProps = {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
};

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="pos-category-tabs">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={selected === category ? "pos-category active" : "pos-category"}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

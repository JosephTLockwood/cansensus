export function SectionHeader({
  num,
  title,
}: {
  num: string;
  title: string;
}) {
  return (
    <div className="sectionHead">
      <span className="sectionNum">{num} —</span>
      <h2 className="sectionTitle">{title}</h2>
    </div>
  );
}

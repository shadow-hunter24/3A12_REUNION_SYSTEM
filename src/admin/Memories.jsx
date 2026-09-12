import "./AdminPages.css";

const MEMORY_FEATURES = [
  {
    id: "photos",
    icon: "📸",
    title: "Class Photos",
    description: "Upload and organise class photographs from SHS and the reunion.",
    status: "coming-soon",
  },
  {
    id: "videos",
    icon: "🎥",
    title: "Videos",
    description: "Store reunion highlights and memorable school videos.",
    status: "coming-soon",
  },
  {
    id: "wall",
    icon: "💭",
    title: "Memory Wall",
    description: "Display stories and messages submitted by classmates.",
    status: "coming-soon",
  },
];

export default function Memories() {
  return (
    <div>

      <div className="page-header">
        <div>
          <p className="page-eyebrow">MEMORY ARCHIVE</p>
          <h1>Photos &amp; Memories</h1>
          <p>
            Manage photos, videos and memorable moments from the Class of 2021.
          </p>
        </div>
      </div>

      {/* Informational notice */}
      <div
        className="memories-notice"
        role="note"
        aria-label="Module status notice"
      >
        <span aria-hidden="true">ℹ </span>
        The Memories module is under development. Features will become
        active once the media storage layer is connected.
      </div>

      <div
        className="feature-grid"
        role="list"
        aria-label="Memory module features"
      >
        {MEMORY_FEATURES.map((feature) => (
          <article
            key={feature.id}
            className="feature-card"
            role="listitem"
            aria-labelledby={`feature-title-${feature.id}`}
          >
            <div aria-hidden="true">{feature.icon}</div>

            <h2 id={`feature-title-${feature.id}`}>{feature.title}</h2>

            <p>{feature.description}</p>

            <button
              disabled
              aria-label={`${feature.title} — coming soon`}
              aria-disabled="true"
              className="memories-coming-soon-btn"
            >
              Coming Soon
            </button>
          </article>
        ))}
      </div>

    </div>
  );
}

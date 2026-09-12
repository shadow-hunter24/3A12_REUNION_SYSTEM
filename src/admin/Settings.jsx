import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  RefreshCw, AlertTriangle, Check, Plus, Trash2, GripVertical,
  Settings as SettingsIcon, Calendar, Wallet, List,
} from "lucide-react";
import "./AdminPages.css";

// ── Helpers ────────────────────────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency", currency: "GHS", minimumFractionDigits: 2,
  }).format(Number(amount || 0)).replace("GHS", "GH₵");
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ icon: Icon, label, title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span className="page-eyebrow">
          <Icon size={13} aria-hidden="true" /> {label}
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Single setting field ───────────────────────────────────────
function SettingField({ setting, saving, onSave }) {
  const [value, setValue] = useState(setting.value ?? "");
  const [dirty, setDirty] = useState(false);

  // Sync if parent reloads
  useEffect(() => {
    setValue(setting.value ?? "");
    setDirty(false);
  }, [setting.value]);

  function handleChange(e) {
    setValue(e.target.value);
    setDirty(true);
  }

  const isBoolean = setting.key === "registration_open";
  const isDate    = setting.key === "event_date";
  const isLong    = ["hero_description", "about_copy"].includes(setting.key);

  return (
    <div className="settings-field">
      <label htmlFor={`setting-${setting.key}`} className="settings-field-label">
        {setting.label}
      </label>

      {isBoolean ? (
        <select
          id={`setting-${setting.key}`}
          value={value}
          onChange={handleChange}
          className="settings-select"
        >
          <option value="true">Open — accepting registrations</option>
          <option value="false">Closed — registration disabled</option>
        </select>
      ) : isDate ? (
        <input
          id={`setting-${setting.key}`}
          type="datetime-local"
          value={value}
          onChange={handleChange}
          className="settings-input"
        />
      ) : isLong ? (
        <textarea
          id={`setting-${setting.key}`}
          value={value}
          onChange={handleChange}
          rows={4}
          className="settings-textarea"
        />
      ) : (
        <input
          id={`setting-${setting.key}`}
          type={setting.key === "default_contribution" ? "number" : "text"}
          value={value}
          onChange={handleChange}
          min={setting.key === "default_contribution" ? "0" : undefined}
          step={setting.key === "default_contribution" ? "0.01" : undefined}
          className="settings-input"
        />
      )}

      {setting.description && (
        <p className="settings-field-hint">{setting.description}</p>
      )}

      <button
        className="admin-primary-button"
        style={{ marginTop: 8, alignSelf: "flex-start" }}
        disabled={!dirty || saving === setting.key}
        aria-busy={saving === setting.key}
        onClick={() => onSave(setting.key, value, () => setDirty(false))}
      >
        {saving === setting.key ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

// ── Programme item row ─────────────────────────────────────────
function ProgrammeRow({ item, saving, onUpdate, onDelete, dragHandleProps }) {
  const [timeLabel,   setTimeLabel]   = useState(item.time_label);
  const [title,       setTitle]       = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTimeLabel(item.time_label);
    setTitle(item.title);
    setDescription(item.description);
    setDirty(false);
  }, [item.time_label, item.title, item.description]);

  function mark(setter) {
    return (e) => { setter(e.target.value); setDirty(true); };
  }

  return (
    <div className="programme-row" aria-label={`Programme item: ${item.title}`}>
      <span
        className="programme-drag-handle"
        aria-hidden="true"
        title="Drag to reorder"
        {...dragHandleProps}
      >
        <GripVertical size={16} />
      </span>

      <div className="programme-row-fields">
        <input
          type="text"
          aria-label="Time"
          value={timeLabel}
          onChange={mark(setTimeLabel)}
          placeholder="e.g. 10:00 AM"
          className="settings-input programme-time"
        />
        <input
          type="text"
          aria-label="Title"
          value={title}
          onChange={mark(setTitle)}
          placeholder="e.g. Arrival & Registration"
          className="settings-input programme-title"
        />
        <input
          type="text"
          aria-label="Description"
          value={description}
          onChange={mark(setDescription)}
          placeholder="Brief description…"
          className="settings-input programme-desc"
        />
      </div>

      <div className="programme-row-actions">
        <button
          className="admin-table-action"
          disabled={!dirty || saving === item.id}
          aria-busy={saving === item.id}
          aria-label={`Save ${item.title}`}
          onClick={() =>
            onUpdate(item.id, { time_label: timeLabel, title, description }, () => setDirty(false))
          }
        >
          {saving === item.id ? "…" : <Check size={14} />}
        </button>
        <button
          className="admin-table-action"
          style={{ background: "#fef3f2", color: "#b42318" }}
          aria-label={`Delete ${item.title}`}
          onClick={() => onDelete(item.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function Settings() {
  const [settings,  setSettings]  = useState([]);
  const [programme, setProgramme] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(null); // key or item id
  const [message,   setMessage]   = useState("");
  const [error,     setError]     = useState("");

  // New programme item form
  const [newItem, setNewItem] = useState({ time_label: "", title: "", description: "" });
  const [addingItem, setAddingItem] = useState(false);
  const [newItemErrors, setNewItemErrors] = useState({});

  // Drag-and-drop state
  const dragId  = useRef(null);
  const dragOverId = useRef(null);

  const flash = useCallback((msg, isError = false) => {
    if (isError) { setError(msg); setMessage(""); }
    else         { setMessage(msg); setError(""); }
    setTimeout(() => { setMessage(""); setError(""); }, 4000);
  }, []);

  // ── Load ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        { data: sData, error: e1 },
        { data: pData, error: e2 },
      ] = await Promise.all([
        supabase.from("site_settings").select("*").order("key"),
        supabase.from("programme_items").select("*").order("sort_order"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setSettings(sData  || []);
      setProgramme(pData || []);
    } catch (err) {
      flash(err.message || "Could not load settings.", true);
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save a single setting ──────────────────────────────────
  async function saveSetting(key, value, onSuccess) {
    setSaving(key);
    try {
      const { error: e } = await supabase
        .from("site_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (e) throw e;
      setSettings((prev) =>
        prev.map((s) => s.key === key ? { ...s, value } : s)
      );
      flash(`"${settings.find((s) => s.key === key)?.label}" saved.`);
      onSuccess?.();
    } catch (err) {
      flash(err.message || "Could not save setting.", true);
    } finally {
      setSaving(null);
    }
  }

  // ── Update programme item ──────────────────────────────────
  async function updateItem(id, fields, onSuccess) {
    setSaving(id);
    try {
      const { error: e } = await supabase
        .from("programme_items")
        .update(fields)
        .eq("id", id);
      if (e) throw e;
      setProgramme((prev) =>
        prev.map((p) => p.id === id ? { ...p, ...fields } : p)
      );
      flash("Programme item updated.");
      onSuccess?.();
    } catch (err) {
      flash(err.message || "Could not update item.", true);
    } finally {
      setSaving(null);
    }
  }

  // ── Delete programme item ──────────────────────────────────
  async function deleteItem(id) {
    setSaving(id);
    try {
      const { error: e } = await supabase
        .from("programme_items").delete().eq("id", id);
      if (e) throw e;
      setProgramme((prev) => prev.filter((p) => p.id !== id));
      flash("Programme item deleted.");
    } catch (err) {
      flash(err.message || "Could not delete item.", true);
    } finally {
      setSaving(null);
    }
  }

  // ── Add new programme item ─────────────────────────────────
  async function addItem(e) {
    e.preventDefault();
    const errs = {};
    if (!newItem.time_label.trim()) errs.time_label = "Time is required.";
    if (!newItem.title.trim())      errs.title      = "Title is required.";
    if (Object.keys(errs).length)   { setNewItemErrors(errs); return; }

    setAddingItem(true);
    try {
      const maxOrder = programme.reduce((m, p) => Math.max(m, p.sort_order), 0);
      const { data, error: e } = await supabase
        .from("programme_items")
        .insert({
          time_label:  newItem.time_label.trim(),
          title:       newItem.title.trim(),
          description: newItem.description.trim(),
          sort_order:  maxOrder + 1,
        })
        .select()
        .single();
      if (e) throw e;
      setProgramme((prev) => [...prev, data]);
      setNewItem({ time_label: "", title: "", description: "" });
      setNewItemErrors({});
      flash("Programme item added.");
    } catch (err) {
      flash(err.message || "Could not add item.", true);
    } finally {
      setAddingItem(false);
    }
  }

  // ── Drag-and-drop reorder ──────────────────────────────────
  function handleDragStart(id) { dragId.current = id; }
  function handleDragEnter(id) { dragOverId.current = id; }

  async function handleDragEnd() {
    if (!dragId.current || dragId.current === dragOverId.current) return;

    const from = programme.findIndex((p) => p.id === dragId.current);
    const to   = programme.findIndex((p) => p.id === dragOverId.current);
    if (from === -1 || to === -1) return;

    const reordered = [...programme];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Assign new sort_order values
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
    setProgramme(updated); // optimistic update

    // Persist to DB
    try {
      await Promise.all(
        updated.map((p) =>
          supabase.from("programme_items")
            .update({ sort_order: p.sort_order })
            .eq("id", p.id)
        )
      );
      flash("Programme order saved.");
    } catch (err) {
      flash("Could not save order. Please try again.", true);
      loadData(); // revert
    }

    dragId.current     = null;
    dragOverId.current = null;
  }

  // ── Derived: group settings by section ────────────────────
  const eventKeys    = ["event_name", "event_tagline", "event_date", "event_venue", "hero_description", "about_copy", "footer_copyright", "registration_open"];
  const financeKeys  = ["default_contribution"];

  const eventSettings   = eventKeys.map((k) => settings.find((s) => s.key === k)).filter(Boolean);
  const financeSettings = financeKeys.map((k) => settings.find((s) => s.key === k)).filter(Boolean);

  if (loading) {
    return (
      <div className="empty-message" role="status" aria-live="polite">
        <span className="admin-page-spinner" aria-hidden="true" />
        <strong>Loading Settings…</strong>
      </div>
    );
  }

  return (
    <div>

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">ADMINISTRATION</p>
          <h1>Settings</h1>
          <p>Control event details, the public homepage content, programme schedule, and financial defaults.</p>
        </div>
        <button
          className="secondary-button"
          onClick={loadData}
          aria-label="Refresh settings"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* FEEDBACK */}
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="admin-success-message" role="status">
            <Check size={15} aria-hidden="true" /> {message}
          </div>
        )}
      </div>
      <div aria-live="assertive">
        {error && (
          <div className="admin-error-message" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {error}
          </div>
        )}
      </div>

      {/* ── EVENT SETTINGS ── */}
      <Section icon={SettingsIcon} label="EVENT SETTINGS" title="Event & Site Content">
        <p className="settings-section-desc">
          These values appear on the public website. Changes take effect immediately after saving.
        </p>
        <div className="settings-fields-grid">
          {eventSettings.map((s) => (
            <SettingField
              key={s.key}
              setting={s}
              saving={saving}
              onSave={saveSetting}
            />
          ))}
        </div>
      </Section>

      {/* ── FINANCIAL SETTINGS ── */}
      <Section icon={Wallet} label="FINANCIAL SETTINGS" title="Contribution Defaults">
        <p className="settings-section-desc">
          The default contribution amount is used for all new registrations and as the fallback
          when no per-classmate override has been set.
        </p>
        <div className="settings-fields-grid">
          {financeSettings.map((s) => (
            <SettingField
              key={s.key}
              setting={s}
              saving={saving}
              onSave={saveSetting}
            />
          ))}
        </div>
        {financeSettings[0] && (
          <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
            Current default:{" "}
            <strong>{formatCurrency(financeSettings[0]?.value || 500)}</strong> per classmate.
            Individual overrides in the Contributions page are not affected by this change.
          </p>
        )}
      </Section>

      {/* ── PROGRAMME ── */}
      <Section icon={List} label="PROGRAMME" title="Event Schedule">
        <p className="settings-section-desc">
          Add, edit, delete or reorder the programme items shown on the public homepage.
          Drag the <GripVertical size={13} style={{ display: "inline", verticalAlign: "middle" }} /> handle to reorder.
        </p>

        {programme.length === 0 ? (
          <div className="empty-message" style={{ padding: "32px 0" }} role="status">
            <List size={32} aria-hidden="true" />
            <strong>No programme items yet</strong>
            <p>Add your first item below.</p>
          </div>
        ) : (
          <div className="programme-list" role="list" aria-label="Programme items">
            {programme.map((item) => (
              <ProgrammeRow
                key={item.id}
                item={item}
                saving={saving}
                onUpdate={updateItem}
                onDelete={deleteItem}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: () => handleDragStart(item.id),
                  onDragEnter: () => handleDragEnter(item.id),
                  onDragEnd:   handleDragEnd,
                  onDragOver:  (e) => e.preventDefault(),
                }}
              />
            ))}
          </div>
        )}

        {/* Add new item form */}
        <form
          className="programme-add-form"
          onSubmit={addItem}
          noValidate
          aria-label="Add programme item"
        >
          <p className="settings-section-desc" style={{ marginBottom: 10 }}>
            <strong>Add a new item</strong>
          </p>
          <div className="programme-add-fields">
            <div>
              <label htmlFor="new-time" className="sr-only">Time</label>
              <input
                id="new-time"
                type="text"
                placeholder="Time (e.g. 10:00 AM)"
                value={newItem.time_label}
                onChange={(e) => { setNewItem((p) => ({ ...p, time_label: e.target.value })); setNewItemErrors((p) => ({ ...p, time_label: null })); }}
                className={`settings-input${newItemErrors.time_label ? " input-error" : ""}`}
                aria-invalid={!!newItemErrors.time_label}
                aria-describedby={newItemErrors.time_label ? "new-time-err" : undefined}
              />
              {newItemErrors.time_label && (
                <p id="new-time-err" className="contrib-field-error" role="alert">
                  <AlertTriangle size={13} aria-hidden="true" /> {newItemErrors.time_label}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="new-title" className="sr-only">Title</label>
              <input
                id="new-title"
                type="text"
                placeholder="Title (e.g. Opening Ceremony)"
                value={newItem.title}
                onChange={(e) => { setNewItem((p) => ({ ...p, title: e.target.value })); setNewItemErrors((p) => ({ ...p, title: null })); }}
                className={`settings-input${newItemErrors.title ? " input-error" : ""}`}
                aria-invalid={!!newItemErrors.title}
                aria-describedby={newItemErrors.title ? "new-title-err" : undefined}
              />
              {newItemErrors.title && (
                <p id="new-title-err" className="contrib-field-error" role="alert">
                  <AlertTriangle size={13} aria-hidden="true" /> {newItemErrors.title}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="new-desc" className="sr-only">Description</label>
              <input
                id="new-desc"
                type="text"
                placeholder="Description (optional)"
                value={newItem.description}
                onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                className="settings-input"
              />
            </div>
            <button
              type="submit"
              className="admin-primary-button"
              disabled={addingItem}
              aria-busy={addingItem}
            >
              <Plus size={15} aria-hidden="true" />
              {addingItem ? "Adding…" : "Add Item"}
            </button>
          </div>
        </form>
      </Section>

    </div>
  );
}

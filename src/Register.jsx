import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { AlertTriangle, Check, X, PartyPopper } from "lucide-react";
import "./Register.css";

function generateClassId() {
  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .substring(0, 8)
    .toUpperCase();
  return `3A12-${randomPart}`;
}

// ── Validation rules (ALL fields required) ────────────────────────────────────
const VALIDATORS = {
  full_name: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Full name is required.";
    if (trimmed.length < 3) return "Full name must be at least 3 characters.";
    if (trimmed.length > 100) return "Full name must be 100 characters or fewer.";
    // Only letters, spaces, hyphens, apostrophes — no digits or random symbols
    if (!/^[a-zA-Z\s'\-]+$/.test(trimmed))
      return "Name may only contain letters, spaces, hyphens or apostrophes — no numbers or special characters.";
    // Must have at least two words (first + last name)
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 2) return "Please enter both your first and last name.";
    return null;
  },

  nickname: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Nickname is required. Enter your school nickname (or your first name if you didn't have one).";
    if (trimmed.length > 50) return "Nickname must be 50 characters or fewer.";
    if (!/^[a-zA-Z0-9\s'\-]+$/.test(trimmed))
      return "Nickname may only contain letters, numbers, spaces, hyphens or apostrophes.";
    return null;
  },

  phone: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Phone number is required.";
    // Strip all formatting — only digits allowed after stripping spaces/dashes/+
    const digits = trimmed.replace(/[\s\-\+\(\)]/g, "");
    if (/[^0-9]/.test(digits))
      return "Phone number must contain digits only — no letters or special characters.";
    if (digits.length < 10)
      return "Phone number must be at least 10 digits (e.g. 0244 123 456).";
    if (digits.length > 15)
      return "Phone number must be 15 digits or fewer.";
    return null;
  },

  email: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Email address is required.";
    // Basic structure: something@something.something
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed))
      return "Enter a valid email address (e.g. name@example.com).";
    // Reject common placeholder/nonsense patterns
    if (/^[a-z]+@[a-z]+\.[a-z]+$/.test(trimmed) && trimmed.length < 8)
      return "Enter a valid email address (e.g. name@example.com).";
    return null;
  },

  class_stream: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Class / Stream is required (e.g. 3A12).";
    if (trimmed.length > 20) return "Class / Stream must be 20 characters or fewer.";
    return null;
  },

  shs_house: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "SHS House is required.";
    if (!/^[a-zA-Z\s'\-]+$/.test(trimmed))
      return "House name may only contain letters, spaces, hyphens or apostrophes.";
    return null;
  },

  occupation: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Occupation / Profession is required.";
    if (trimmed.length < 2) return "Please enter a valid occupation.";
    if (trimmed.length > 100) return "Occupation must be 100 characters or fewer.";
    // Must contain at least some letters — reject pure numbers/symbols
    if (!/[a-zA-Z]/.test(trimmed))
      return "Occupation must contain at least some letters.";
    return null;
  },

  organization: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Organization / Business is required. Enter 'N/A' or 'Self-employed' if not applicable.";
    if (trimmed.length > 150) return "Organization must be 150 characters or fewer.";
    return null;
  },

  location: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Current location is required (e.g. Accra, Ghana).";
    if (trimmed.length < 3) return "Please enter a valid location.";
    if (trimmed.length > 100) return "Location must be 100 characters or fewer.";
    // Must contain at least some letters
    if (!/[a-zA-Z]/.test(trimmed))
      return "Location must contain at least some letters.";
    return null;
  },

  tshirt_size: (v, formData) => {
    if (formData.attending && Number(formData.tshirt_quantity) > 0 && !v)
      return "Please select a T-shirt size for your order.";
    return null;
  },

  tshirt_quantity: (v, formData) => {
    const n = Number(v);
    if (formData.attending && isNaN(n))
      return "Please enter a valid quantity.";
    if (n < 0) return "Quantity cannot be negative.";
    if (n > 10) return "Maximum 10 T-shirts per registration.";
    return null;
  },

  favourite_memory: (v) => {
    const trimmed = v.trim();
    if (!trimmed) return "Please share a favourite memory — it helps make the reunion special!";
    if (trimmed.length < 10) return "Please write at least 10 characters for your memory.";
    // Reject pure repetitive garbage like "aaaaaaa"
    if (/^(.)\1{9,}$/.test(trimmed.replace(/\s/g, "")))
      return "Please enter a genuine memory — repeating the same character isn't valid.";
    return null;
  },

  privacy_consent: (v) => {
    if (!v) return "Consent is required to proceed. Your data will only be used for reunion purposes.";
    return null;
  },
};

// All fields that get validated on submit
const ALL_FIELDS = [
  "full_name", "nickname", "phone", "email",
  "class_stream", "shs_house",
  "occupation", "organization", "location",
  "tshirt_size", "tshirt_quantity",
  "favourite_memory", "privacy_consent",
];

function validate(name, value, formData) {
  return VALIDATORS[name] ? VALIDATORS[name](value, formData) : null;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id} role="alert" aria-live="polite">
      <AlertTriangle size={13} aria-hidden="true" />
      {message}
    </p>
  );
}

function FieldHint({ id, children }) {
  return <p className="field-hint" id={id}>{children}</p>;
}

function CharCounter({ value, max }) {
  const near = max - value.length <= 50;
  return (
    <span className={`char-counter${near ? " near-limit" : ""}`} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Register() {
  // Load global default contribution amount from site_settings
  const [defaultContribution, setDefaultContribution] = useState(500);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "default_contribution")
      .single()
      .then(({ data }) => {
        const val = Number(data?.value);
        if (val > 0) setDefaultContribution(val);
      });
  }, []);

  const [formData, setFormData] = useState({
    full_name: "",
    nickname: "",
    phone: "",
    email: "",
    class_stream: "",
    shs_house: "",
    occupation: "",
    organization: "",
    location: "",
    attending: true,
    guests: 0,
    tshirt_size: "",
    tshirt_quantity: 1,
    favourite_memory: "",
    privacy_consent: false,
  });

  const [touched, setTouched]         = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [classId, setClassId]         = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showConsentDetail, setShowConsentDetail] = useState(false);

  // Validate a single field on blur
  const handleBlur = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      const fieldValue = type === "checkbox" ? checked : value;
      setTouched((prev) => ({ ...prev, [name]: true }));
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validate(name, fieldValue, formData),
      }));
    },
    [formData]
  );

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: fieldValue }));
    // Re-validate on change once the field has been touched
    if (touched[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validate(name, fieldValue, { ...formData, [name]: fieldValue }),
      }));
    }
  }

  // Phone: only allow digits, spaces, +, -, (, ) — strip letters as typed
  function handlePhoneChange(e) {
    const raw = e.target.value.replace(/[^0-9\s\+\-\(\)]/g, "");
    const synth = { target: { name: "phone", value: raw, type: "text", checked: false } };
    handleChange(synth);
  }

  function handleAttendingChange(value) {
    setFormData((prev) => ({ ...prev, attending: value }));
  }

  // Full-form validation on submit
  function validateAll() {
    const errors = {};
    const newTouched = { ...touched };

    ALL_FIELDS.forEach((name) => {
      // Skip t-shirt fields if not attending
      if (!formData.attending && (name === "tshirt_size" || name === "tshirt_quantity")) return;
      const error = validate(name, formData[name], formData);
      if (error) errors[name] = error;
      newTouched[name] = true;
    });

    setTouched(newTouched);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    if (!validateAll()) {
      setTimeout(() => {
        const firstError = document.querySelector(".field-error");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
          firstError.closest(".form-group")?.querySelector("input, select, textarea")?.focus();
        }
      }, 50);
      return;
    }

    setLoading(true);

    // Duplicate phone check
    const { data: existing } = await supabase
      .from("classmates")
      .select("id")
      .eq("phone", formData.phone.trim())
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setSubmitError(
        "A registration already exists for this phone number. If you believe this is an error, please contact the reunion committee."
      );
      return;
    }

    const generatedId  = generateClassId();
    const registration = {
      ...formData,
      full_name:       formData.full_name.trim(),
      nickname:        formData.nickname.trim(),
      phone:           formData.phone.replace(/[^0-9\+]/g, ""),
      email:           formData.email.trim().toLowerCase(),
      class_stream:    formData.class_stream.trim().toUpperCase(),
      shs_house:       formData.shs_house.trim(),
      occupation:      formData.occupation.trim(),
      organization:    formData.organization.trim(),
      location:        formData.location.trim(),
      class_id:        generatedId,
      guests:          Number(formData.guests),
      tshirt_quantity: Number(formData.tshirt_quantity),
    };

    const { data: registeredClassmate, error: registrationError } = await supabase
      .from("classmates")
      .insert([registration])
      .select()
      .single();

    if (registrationError) {
      console.error(registrationError);
      setLoading(false);
      const code = registrationError.code;
      if (code === "23505") {
        setSubmitError(
          "A registration with this phone number or email already exists. Please check your details or contact the reunion committee."
        );
      } else if (code === "42501") {
        setSubmitError("Submission was blocked due to a permissions issue. Please try again.");
      } else {
        setSubmitError(
          "We couldn't complete your registration right now. Please check your internet connection and try again."
        );
      }
      return;
    }

    // Create contribution record
    await supabase.from("contributions").insert({
      classmate_id:    registeredClassmate.id,
      expected_amount: defaultContribution,
      amount_paid:     0.0,
      payment_status:  "UNPAID",
    });

    setLoading(false);
    setClassId(generatedId);
    setSuccess(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="registration-page">
        <div className="success-card" role="main" aria-labelledby="success-heading">
          <div className="success-icon" aria-hidden="true"><Check size={36} /></div>
          <p className="eyebrow">REGISTRATION SUCCESSFUL</p>
          <h1 id="success-heading">
            Welcome back, {formData.full_name.trim().split(" ")[0]}!
          </h1>
          <p>
            Your registration for the{" "}
            <strong>Class of 2021 5th Anniversary Reunion</strong> has been received.
            We're excited to see you!
          </p>
          <div className="class-id-box" aria-label="Your Classmate ID">
            <span>Your Classmate ID</span>
            <strong>{classId}</strong>
          </div>
          <p className="small-note">
            Keep this ID safe — you'll need it for your digital pass and check-in on the day.
          </p>
          <div className="success-actions">
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(classId)}
              aria-label={`Copy Classmate ID ${classId} to clipboard`}
            >
              Copy ID
            </button>
            <Link to="/" className="primary-button">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const err        = (name) => (touched[name] ? fieldErrors[name] : null);
  const inputState = (name) => {
    if (!touched[name]) return "";
    return fieldErrors[name] ? "is-invalid" : "is-valid";
  };

  // Progress: count sections that have all required fields filled without errors
  const sectionDone = [
    formData.full_name.trim() && formData.nickname.trim() &&
      formData.phone.trim() && formData.email.trim() &&
      !fieldErrors.full_name && !fieldErrors.nickname &&
      !fieldErrors.phone && !fieldErrors.email,

    formData.class_stream.trim() && formData.shs_house.trim(),

    formData.occupation.trim() && formData.organization.trim() && formData.location.trim(),

    formData.attending !== null,

    formData.favourite_memory.trim().length >= 10,

    formData.privacy_consent,
  ].filter(Boolean).length;

  const progressPercent = Math.round((sectionDone / 6) * 100);

  return (
    <div className="registration-page">
      <div className="registration-container">

        {/* Header */}
        <div className="registration-header">
          <Link to="/" className="back-link" aria-label="Go back to home page">
            ← Back to Home
          </Link>
          <p className="eyebrow">CLASS OF 2021</p>
          <h1>Reunion Registration</h1>
          <p>
            All fields marked <span className="required-star" aria-label="required">*</span> are
            required. Please fill in accurate information — it helps us prepare for the event.
          </p>
        </div>

        {/* Progress bar */}
        <div className="progress-bar-wrapper" aria-label={`Form ${progressPercent}% complete`}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span className="progress-label">{progressPercent}% complete</span>
        </div>

        {/* Submit error banner */}
        {submitError && (
          <div className="submit-error-banner" role="alert" aria-live="assertive">
            <span className="error-icon" aria-hidden="true"><X size={16} /></span>
            <div>
              <strong>Registration couldn't be submitted</strong>
              <p>{submitError}</p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="registration-form"
          noValidate
          aria-label="Reunion registration form"
        >

          {/* ── 01 PERSONAL INFORMATION ─────────────────────────── */}
          <section className="form-section" aria-labelledby="section-personal">
            <div className="section-heading">
              <span aria-hidden="true">01</span>
              <div>
                <h2 id="section-personal">Personal Information</h2>
                <p>Tell us who you are.</p>
              </div>
            </div>

            <div className="form-grid">

              {/* Full name */}
              <div className={`form-group full-width ${inputState("full_name")}`}>
                <label htmlFor="full_name">
                  Full Name <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Kwame Asante Mensah"
                  autoComplete="name"
                  aria-required="true"
                  aria-describedby="full_name-hint full_name-error"
                  aria-invalid={!!err("full_name")}
                />
                <FieldHint id="full_name-hint">
                  First and last name. Letters only — no numbers or symbols.
                </FieldHint>
                <FieldError id="full_name-error" message={err("full_name")} />
              </div>

              {/* Nickname */}
              <div className={`form-group ${inputState("nickname")}`}>
                <label htmlFor="nickname">
                  Nickname <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="nickname"
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="What did your classmates call you?"
                  autoComplete="nickname"
                  aria-required="true"
                  aria-describedby="nickname-hint nickname-error"
                  aria-invalid={!!err("nickname")}
                />
                <FieldHint id="nickname-hint">
                  Your school nickname. Use your first name if you didn't have one.
                </FieldHint>
                <FieldError id="nickname-error" message={err("nickname")} />
              </div>

              {/* Phone */}
              <div className={`form-group ${inputState("phone")}`}>
                <label htmlFor="phone">
                  Phone / WhatsApp <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  onBlur={handleBlur}
                  placeholder="0244 123 456"
                  autoComplete="tel"
                  inputMode="numeric"
                  aria-required="true"
                  aria-describedby="phone-hint phone-error"
                  aria-invalid={!!err("phone")}
                />
                <FieldHint id="phone-hint">
                  Digits only. Used only for reunion communication.
                </FieldHint>
                <FieldError id="phone-error" message={err("phone")} />
              </div>

              {/* Email */}
              <div className={`form-group full-width ${inputState("email")}`}>
                <label htmlFor="email">
                  Email Address <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="yourname@example.com"
                  autoComplete="email"
                  aria-required="true"
                  aria-describedby="email-hint email-error"
                  aria-invalid={!!err("email")}
                />
                <FieldHint id="email-hint">
                  Used for your digital pass and reunion updates.
                </FieldHint>
                <FieldError id="email-error" message={err("email")} />
              </div>

            </div>
          </section>


          {/* ── 02 CLASS INFORMATION ────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-class">
            <div className="section-heading">
              <span aria-hidden="true">02</span>
              <div>
                <h2 id="section-class">Class Information</h2>
                <p>Help us identify you from our class records.</p>
              </div>
            </div>

            <div className="form-grid">

              {/* Class stream */}
              <div className={`form-group ${inputState("class_stream")}`}>
                <label htmlFor="class_stream">
                  Class / Stream <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="class_stream"
                  type="text"
                  name="class_stream"
                  value={formData.class_stream}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. 3A12"
                  aria-required="true"
                  aria-describedby="class_stream-hint class_stream-error"
                  aria-invalid={!!err("class_stream")}
                />
                <FieldHint id="class_stream-hint">Your class group in final year.</FieldHint>
                <FieldError id="class_stream-error" message={err("class_stream")} />
              </div>

              {/* SHS House */}
              <div className={`form-group ${inputState("shs_house")}`}>
                <label htmlFor="shs_house">
                  SHS House <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="shs_house"
                  type="text"
                  name="shs_house"
                  value={formData.shs_house}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Nkrumah, Aggrey…"
                  aria-required="true"
                  aria-describedby="shs_house-hint shs_house-error"
                  aria-invalid={!!err("shs_house")}
                />
                <FieldHint id="shs_house-hint">The house you belonged to.</FieldHint>
                <FieldError id="shs_house-error" message={err("shs_house")} />
              </div>

            </div>
          </section>


          {/* ── 03 LIFE AFTER SHS ───────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-life">
            <div className="section-heading">
              <span aria-hidden="true">03</span>
              <div>
                <h2 id="section-life">Life After SHS</h2>
                <p>Let's see where life has taken you.</p>
              </div>
            </div>

            <div className="form-grid">

              {/* Occupation */}
              <div className={`form-group ${inputState("occupation")}`}>
                <label htmlFor="occupation">
                  Occupation / Profession <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="occupation"
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Software Developer, Nurse, Student"
                  autoComplete="organization-title"
                  aria-required="true"
                  aria-describedby="occupation-error"
                  aria-invalid={!!err("occupation")}
                />
                <FieldError id="occupation-error" message={err("occupation")} />
              </div>

              {/* Organization */}
              <div className={`form-group ${inputState("organization")}`}>
                <label htmlFor="organization">
                  Organization / Business <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="organization"
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Company name, university, or N/A"
                  autoComplete="organization"
                  aria-required="true"
                  aria-describedby="organization-hint organization-error"
                  aria-invalid={!!err("organization")}
                />
                <FieldHint id="organization-hint">
                  Enter "N/A" or "Self-employed" if not applicable.
                </FieldHint>
                <FieldError id="organization-error" message={err("organization")} />
              </div>

              {/* Location */}
              <div className={`form-group full-width ${inputState("location")}`}>
                <label htmlFor="location">
                  Current Location <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Accra, Ghana"
                  autoComplete="address-level2"
                  aria-required="true"
                  aria-describedby="location-error"
                  aria-invalid={!!err("location")}
                />
                <FieldError id="location-error" message={err("location")} />
              </div>

            </div>
          </section>


          {/* ── 04 REUNION DETAILS ──────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-reunion">
            <div className="section-heading">
              <span aria-hidden="true">04</span>
              <div>
                <h2 id="section-reunion">Reunion Details</h2>
                <p>Help us prepare for your attendance.</p>
              </div>
            </div>

            <div className="form-group" role="group" aria-labelledby="attending-label">
              <span id="attending-label" className="group-label">
                Will you attend the reunion?{" "}
                <span className="required-star" aria-hidden="true">*</span>
              </span>

              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="attending"
                    value="true"
                    checked={formData.attending === true}
                    onChange={() => handleAttendingChange(true)}
                    aria-describedby="attending-yes-desc"
                  />
                  <span>
                    <strong>Yes, I'll be there</strong> <PartyPopper size={15} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle" }} />
                    <span id="attending-yes-desc" className="radio-desc">I plan to attend in person.</span>
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="attending"
                    value="false"
                    checked={formData.attending === false}
                    onChange={() => handleAttendingChange(false)}
                    aria-describedby="attending-no-desc"
                  />
                  <span>
                    <strong>I can't make it</strong>
                    <span id="attending-no-desc" className="radio-desc">
                      Register to still be part of the class directory.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {formData.attending && (
              <div className="form-grid reunion-fields">

                <div className="form-group">
                  <label htmlFor="guests">Number of Guests</label>
                  <select
                    id="guests"
                    name="guests"
                    value={formData.guests}
                    onChange={handleChange}
                    aria-describedby="guests-hint"
                  >
                    <option value="0">Just me</option>
                    <option value="1">1 guest</option>
                    <option value="2">2 guests</option>
                    <option value="3">3 guests</option>
                    <option value="4">4 guests</option>
                  </select>
                  <FieldHint id="guests-hint">
                    Each guest will be counted in final attendance numbers.
                  </FieldHint>
                </div>

                <div className={`form-group ${inputState("tshirt_size")}`}>
                  <label htmlFor="tshirt_size">
                    T-Shirt Size <span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="tshirt_size"
                    name="tshirt_size"
                    value={formData.tshirt_size}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-required="true"
                    aria-describedby="tshirt_size-hint tshirt_size-error"
                    aria-invalid={!!err("tshirt_size")}
                  >
                    <option value="">Select your size</option>
                    <option value="S">S — Small</option>
                    <option value="M">M — Medium</option>
                    <option value="L">L — Large</option>
                    <option value="XL">XL — Extra Large</option>
                    <option value="XXL">XXL — Double Extra Large</option>
                    <option value="XXXL">XXXL — Triple Extra Large</option>
                  </select>
                  <FieldHint id="tshirt_size-hint">Required if ordering a T-shirt.</FieldHint>
                  <FieldError id="tshirt_size-error" message={err("tshirt_size")} />
                </div>

                <div className={`form-group ${inputState("tshirt_quantity")}`}>
                  <label htmlFor="tshirt_quantity">T-Shirt Quantity</label>
                  <input
                    id="tshirt_quantity"
                    type="number"
                    name="tshirt_quantity"
                    min="0"
                    max="10"
                    value={formData.tshirt_quantity}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-describedby="tshirt_quantity-hint tshirt_quantity-error"
                    aria-invalid={!!err("tshirt_quantity")}
                  />
                  <FieldHint id="tshirt_quantity-hint">Max 10 per registration.</FieldHint>
                  <FieldError id="tshirt_quantity-error" message={err("tshirt_quantity")} />
                </div>

              </div>
            )}
          </section>


          {/* ── 05 MEMORY LANE ──────────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-memory">
            <div className="section-heading">
              <span aria-hidden="true">05</span>
              <div>
                <h2 id="section-memory">Memory Lane</h2>
                <p>Give us something to remember.</p>
              </div>
            </div>

            <div className={`form-group full-width ${inputState("favourite_memory")}`}>
              <div className="label-row">
                <label htmlFor="favourite_memory">
                  Favourite Memory from SHS <span className="required-star" aria-hidden="true">*</span>
                </label>
                <CharCounter value={formData.favourite_memory} max={500} />
              </div>
              <textarea
                id="favourite_memory"
                name="favourite_memory"
                value={formData.favourite_memory}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Tell us about a funny, memorable or unforgettable moment…"
                rows="5"
                maxLength={500}
                aria-required="true"
                aria-describedby="memory-hint memory-error"
                aria-invalid={!!err("favourite_memory")}
              />
              <FieldHint id="memory-hint">
                At least 10 characters. May be featured (with your permission) in the reunion programme.
              </FieldHint>
              <FieldError id="memory-error" message={err("favourite_memory")} />
            </div>
          </section>


          {/* ── CONSENT ─────────────────────────────────────────── */}
          <section className="consent-section" aria-labelledby="consent-heading">
            <h2 id="consent-heading" className="consent-heading">
              Your Privacy &amp; Consent
            </h2>

            <p className="consent-description">
              We collect this information solely to organise the Class of 2021 reunion.
              It will never be sold or shared with third parties.
            </p>

            <button
              type="button"
              className="consent-detail-toggle"
              onClick={() => setShowConsentDetail((v) => !v)}
              aria-expanded={showConsentDetail}
              aria-controls="consent-detail"
            >
              {showConsentDetail ? "Hide details ▲" : "What exactly will be shared? ▼"}
            </button>

            {showConsentDetail && (
              <div id="consent-detail" className="consent-detail" role="region" aria-label="Consent details">
                <ul>
                  <li>Your <strong>name and nickname</strong> may appear on a printed reunion programme and name badge.</li>
                  <li>Your <strong>phone number</strong> will be used only for reunion communication via WhatsApp.</li>
                  <li>Your <strong>occupation and location</strong> may appear in a class directory shared only among verified classmates.</li>
                  <li>Your <strong>favourite memory</strong> will only be published with your explicit permission.</li>
                  <li>You may request deletion of your data at any time by contacting the reunion committee.</li>
                </ul>
              </div>
            )}

            <label
              className={`consent-option ${touched.privacy_consent && !formData.privacy_consent ? "consent-error" : ""}`}
            >
              <input
                type="checkbox"
                name="privacy_consent"
                checked={formData.privacy_consent}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-required="true"
                aria-describedby="consent-error"
                aria-invalid={!!err("privacy_consent")}
              />
              <span>
                I consent to my information being used for organising the Class of 2021 reunion
                and related class activities. I understand my data will not be publicly displayed
                without my permission, and I may withdraw consent at any time.{" "}
                <span className="required-star" aria-hidden="true">*</span>
              </span>
            </label>

            <FieldError id="consent-error" message={err("privacy_consent")} />
          </section>


          {/* ── SUBMIT ──────────────────────────────────────────── */}
          <div className="submit-area">
            <button
              type="submit"
              className="submit-button"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <><span className="spinner" aria-hidden="true" /> Submitting your registration…</>
              ) : (
                "Complete Registration →"
              )}
            </button>

            <p className="submit-note">
              By submitting, you confirm all information is accurate to the best of your knowledge.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}

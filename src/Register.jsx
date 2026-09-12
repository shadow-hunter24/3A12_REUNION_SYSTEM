import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./Register.css";

function generateClassId() {
  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .substring(0, 8)
    .toUpperCase();
  return `3A12-${randomPart}`;
}

// ── Validation rules ──────────────────────────────────────────────────────────
const VALIDATORS = {
  full_name: (v) => {
    if (!v.trim()) return "Full name is required.";
    if (v.trim().length < 3) return "Please enter your complete name (at least 3 characters).";
    if (!/^[a-zA-Z\s'-]+$/.test(v.trim()))
      return "Name may only contain letters, spaces, hyphens or apostrophes.";
    return null;
  },
  phone: (v) => {
    if (!v.trim()) return "Phone number is required so we can reach you.";
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10)
      return "Enter a valid phone number with at least 10 digits (e.g. 024 XXX XXXX).";
    return null;
  },
  email: (v) => {
    if (!v.trim()) return null; // optional field
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return "That doesn't look like a valid email address (e.g. name@example.com).";
    return null;
  },
  tshirt_size: (v, formData) => {
    if (formData.attending && formData.tshirt_quantity > 0 && !v)
      return "Please choose a T-shirt size for your order.";
    return null;
  },
  tshirt_quantity: (v) => {
    const n = Number(v);
    if (n < 0) return "Quantity cannot be negative.";
    if (n > 10) return "Maximum 10 T-shirts per registration.";
    return null;
  },
  privacy_consent: (v) => {
    if (!v)
      return "Consent is required to proceed — your data will only be used for reunion purposes.";
    return null;
  },
};

function validate(name, value, formData) {
  return VALIDATORS[name] ? VALIDATORS[name](value, formData) : null;
}

// ── Field-level helper component ──────────────────────────────────────────────
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id} role="alert" aria-live="polite">
      <span aria-hidden="true">⚠ </span>
      {message}
    </p>
  );
}

function FieldHint({ id, children }) {
  return (
    <p className="field-hint" id={id}>
      {children}
    </p>
  );
}

// ── Character counter ─────────────────────────────────────────────────────────
function CharCounter({ value, max }) {
  const remaining = max - value.length;
  const nearLimit = remaining <= 50;
  return (
    <span className={`char-counter ${nearLimit ? "near-limit" : ""}`} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

export default function Register() {
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

  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [classId, setClassId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showConsentDetail, setShowConsentDetail] = useState(false);

  // Mark a field as touched and validate immediately
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

    // Clear the error as soon as the user starts correcting
    if (touched[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validate(name, fieldValue, { ...formData, [name]: fieldValue }),
      }));
    }
  }

  function handleAttendingChange(value) {
    setFormData((prev) => ({ ...prev, attending: value }));
  }

  // Run full validation and return whether the form is clean
  function validateAll() {
    const validatableFields = ["full_name", "phone", "email", "tshirt_size", "tshirt_quantity", "privacy_consent"];
    const errors = {};
    const newTouched = { ...touched };

    validatableFields.forEach((name) => {
      const value =
        name === "tshirt_size" || name === "tshirt_quantity" || name === "privacy_consent"
          ? formData[name]
          : formData[name];
      const error = validate(name, value, formData);
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
      // Scroll to the first error
      const firstError = document.querySelector(".field-error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.closest(".form-group")?.querySelector("input, select, textarea")?.focus();
      }
      return;
    }

    setLoading(true);

    // Duplicate phone check — ethical: let the user know clearly
    const { data: existing } = await supabase
      .from("classmates")
      .select("id")
      .eq("phone", formData.phone.trim())
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setSubmitError(
        "A registration with this phone number already exists. If you believe this is an error, please contact the reunion committee."
      );
      return;
    }

    const generatedId = generateClassId();
    const registration = {
      ...formData,
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      class_id: generatedId,
      guests: Number(formData.guests),
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

      // Map known Supabase error codes to friendly messages
      const code = registrationError.code;
      if (code === "23505") {
        setSubmitError(
          "A registration with this phone number or email already exists. Please check your details or contact the reunion committee."
        );
      } else if (code === "42501") {
        setSubmitError(
          "Submission was blocked due to a permissions issue. Please try again or contact support."
        );
      } else {
        setSubmitError(
          "We couldn't complete your registration right now. Please check your internet connection and try again. If the problem continues, contact the reunion committee."
        );
      }
      return;
    }

    // Create contribution record
    const { error: contributionError } = await supabase
      .from("contributions")
      .insert({
        classmate_id: registeredClassmate.id,
        expected_amount: 500.0,
        amount_paid: 0.0,
        payment_status: "UNPAID",
      });

    if (contributionError) {
      console.error("Contribution record could not be created:", contributionError);
      // Non-blocking — registration succeeded, so we still show success
    }

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
          <div className="success-icon" aria-hidden="true">✓</div>

          <p className="eyebrow">REGISTRATION SUCCESSFUL</p>

          <h1 id="success-heading">Welcome Back, Classmate!</h1>

          <p>
            Your registration for the{" "}
            <strong>Class of 2021 5th Anniversary Reunion</strong> has been
            received. We're excited to see you!
          </p>

          <div className="class-id-box" aria-label="Your Classmate ID">
            <span>Your Classmate ID</span>
            <strong>{classId}</strong>
          </div>

          <p className="small-note">
            Keep this ID safe — you'll need it for your digital pass and
            check-in on the day of the event.
          </p>

          <div className="success-actions">
            <button
              className="copy-button"
              onClick={() => {
                navigator.clipboard.writeText(classId);
              }}
              aria-label={`Copy your Classmate ID ${classId} to clipboard`}
            >
              Copy ID
            </button>

            <Link to="/" className="primary-button">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const err = (name) => (touched[name] ? fieldErrors[name] : null);
  const inputState = (name) => {
    if (!touched[name]) return "";
    return fieldErrors[name] ? "is-invalid" : "is-valid";
  };

  const completedSections = [
    formData.full_name.trim() && formData.phone.trim(),
    formData.class_stream || formData.shs_house,
    formData.occupation || formData.location,
    formData.attending !== null,
    formData.favourite_memory.trim(),
    formData.privacy_consent,
  ].filter(Boolean).length;

  const totalSections = 5;
  const progressPercent = Math.round((completedSections / totalSections) * 100);

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="registration-page">
      <div className="registration-container">

        <div className="registration-header">
          <Link to="/" className="back-link" aria-label="Go back to home page">
            ← Back to Home
          </Link>

          <p className="eyebrow">CLASS OF 2021</p>
          <h1>Reunion Registration</h1>
          <p>
            Let's reconnect, celebrate our journey and create new memories
            together. Fields marked <span aria-label="required">*</span> are
            required.
          </p>
        </div>

        {/* Progress bar — visibility into completion */}
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

        {/* Top-level submit error */}
        {submitError && (
          <div
            className="submit-error-banner"
            role="alert"
            aria-live="assertive"
          >
            <span className="error-icon" aria-hidden="true">✕</span>
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

          {/* ── 01 PERSONAL INFORMATION ─────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-personal">
            <div className="section-heading">
              <span aria-hidden="true">01</span>
              <div>
                <h2 id="section-personal">Personal Information</h2>
                <p>Tell us who you are.</p>
              </div>
            </div>

            <div className="form-grid">

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
                  placeholder="Enter your full name as it appears on your ID"
                  autoComplete="name"
                  aria-required="true"
                  aria-describedby="full_name-hint full_name-error"
                  aria-invalid={!!err("full_name")}
                />
                <FieldHint id="full_name-hint">
                  As it appears on your school records or national ID.
                </FieldHint>
                <FieldError id="full_name-error" message={err("full_name")} />
              </div>

              <div className="form-group">
                <label htmlFor="nickname">Nickname</label>
                <input
                  id="nickname"
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="What did your classmates call you?"
                  autoComplete="nickname"
                  aria-describedby="nickname-hint"
                />
                <FieldHint id="nickname-hint">Optional — helps classmates recognise you.</FieldHint>
              </div>

              <div className={`form-group ${inputState("phone")}`}>
                <label htmlFor="phone">
                  Phone / WhatsApp <span className="required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="024 XXX XXXX"
                  autoComplete="tel"
                  aria-required="true"
                  aria-describedby="phone-hint phone-error"
                  aria-invalid={!!err("phone")}
                />
                <FieldHint id="phone-hint">
                  Used only for reunion-related communication.
                </FieldHint>
                <FieldError id="phone-error" message={err("phone")} />
              </div>

              <div className={`form-group full-width ${inputState("email")}`}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="example@email.com"
                  autoComplete="email"
                  aria-describedby="email-hint email-error"
                  aria-invalid={!!err("email")}
                />
                <FieldHint id="email-hint">
                  Optional, but useful for digital passes and updates.
                </FieldHint>
                <FieldError id="email-error" message={err("email")} />
              </div>

            </div>
          </section>


          {/* ── 02 CLASS INFORMATION ────────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-class">
            <div className="section-heading">
              <span aria-hidden="true">02</span>
              <div>
                <h2 id="section-class">Class Information</h2>
                <p>Help us identify you from our class records.</p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="class_stream">Class / Stream</label>
                <input
                  id="class_stream"
                  type="text"
                  name="class_stream"
                  value={formData.class_stream}
                  onChange={handleChange}
                  placeholder="e.g. 3A12"
                  aria-describedby="class_stream-hint"
                />
                <FieldHint id="class_stream-hint">Your class group in final year.</FieldHint>
              </div>

              <div className="form-group">
                <label htmlFor="shs_house">SHS House</label>
                <input
                  id="shs_house"
                  type="text"
                  name="shs_house"
                  value={formData.shs_house}
                  onChange={handleChange}
                  placeholder="e.g. Nkrumah, Aggrey…"
                  aria-describedby="shs_house-hint"
                />
                <FieldHint id="shs_house-hint">The house you belonged to.</FieldHint>
              </div>

            </div>
          </section>


          {/* ── 03 LIFE AFTER SHS ───────────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-life">
            <div className="section-heading">
              <span aria-hidden="true">03</span>
              <div>
                <h2 id="section-life">Life After SHS</h2>
                <p>Let's see where life has taken you.</p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="occupation">Occupation / Profession</label>
                <input
                  id="occupation"
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  placeholder="e.g. Software Developer"
                  autoComplete="organization-title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="organization">Organization / Business</label>
                <input
                  id="organization"
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder="Company or business name"
                  autoComplete="organization"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="location">Current Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Accra, Ghana"
                  autoComplete="address-level2"
                />
              </div>

            </div>
          </section>


          {/* ── 04 REUNION DETAILS ──────────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-reunion">
            <div className="section-heading">
              <span aria-hidden="true">04</span>
              <div>
                <h2 id="section-reunion">Reunion Details</h2>
                <p>Help us prepare for your attendance.</p>
              </div>
            </div>

            <div
              className="form-group"
              role="group"
              aria-labelledby="attending-label"
            >
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
                    <strong>Yes, I'll be there</strong> 🎉
                    <span id="attending-yes-desc" className="radio-desc">
                      I plan to attend in person.
                    </span>
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
                  <label htmlFor="tshirt_size">T-Shirt Size</label>
                  <select
                    id="tshirt_size"
                    name="tshirt_size"
                    value={formData.tshirt_size}
                    onChange={handleChange}
                    onBlur={handleBlur}
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
                  <FieldHint id="tshirt_size-hint">
                    Required if you're ordering a T-shirt.
                  </FieldHint>
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


          {/* ── 05 MEMORY LANE ──────────────────────────────────────── */}
          <section className="form-section" aria-labelledby="section-memory">
            <div className="section-heading">
              <span aria-hidden="true">05</span>
              <div>
                <h2 id="section-memory">Memory Lane</h2>
                <p>Give us something to remember.</p>
              </div>
            </div>

            <div className="form-group full-width">
              <div className="label-row">
                <label htmlFor="favourite_memory">
                  What is your favourite memory from SHS?
                </label>
                <CharCounter value={formData.favourite_memory} max={500} />
              </div>

              <textarea
                id="favourite_memory"
                name="favourite_memory"
                value={formData.favourite_memory}
                onChange={handleChange}
                placeholder="Tell us about a funny, memorable or unforgettable moment…"
                rows="5"
                maxLength={500}
                aria-describedby="memory-hint"
              />
              <FieldHint id="memory-hint">
                Entirely optional. Your response may be shared (anonymously, if
                you prefer) in the reunion programme — only with your consent.
              </FieldHint>
            </div>
          </section>


          {/* ── CONSENT ─────────────────────────────────────────────── */}
          <section className="consent-section" aria-labelledby="consent-heading">
            <h2 id="consent-heading" className="consent-heading">
              Your Privacy &amp; Consent
            </h2>

            <p className="consent-description">
              We collect this information solely to organise the Class of 2021
              reunion. It will never be sold or shared with third parties.
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

            <label className={`consent-option ${touched.privacy_consent && !formData.privacy_consent ? "consent-error" : ""}`}>
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
                I consent to my information being used for organising the Class
                of 2021 reunion and related class activities. I understand my
                data will not be publicly displayed without my permission, and I
                may withdraw consent at any time. <span className="required-star" aria-hidden="true">*</span>
              </span>
            </label>

            <FieldError id="consent-error" message={err("privacy_consent")} />
          </section>


          {/* ── SUBMIT ──────────────────────────────────────────────── */}
          <div className="submit-area">
            <button
              type="submit"
              className="submit-button"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Submitting your registration…
                </>
              ) : (
                "Complete Registration →"
              )}
            </button>

            <p className="submit-note">
              By submitting, you confirm all information is accurate to the best
              of your knowledge.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}

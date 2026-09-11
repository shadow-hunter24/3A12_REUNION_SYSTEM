import { useState } from "react";
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

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [classId, setClassId] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!formData.privacy_consent) {
      setError(
        "Please give consent for your information to be used for reunion organization."
      );
      return;
    }

    setLoading(true);

    const generatedId = generateClassId();

    const registration = {
      ...formData,
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
      setError(
        "Registration could not be completed. Please check your information and try again."
      );
      return;
    }

    // Create a GH₵500 unpaid contribution record linked to the new classmate
    const { error: contributionError } = await supabase
      .from("contributions")
      .insert({
        classmate_id: registeredClassmate.id,
        expected_amount: 500.00,
        amount_paid: 0.00,
        payment_status: "UNPAID",
      });

    if (contributionError) {
      console.error(
        "Contribution record could not be created:",
        contributionError
      );
    }

    setLoading(false);
    setClassId(generatedId);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="registration-page">
        <div className="success-card">
          <div className="success-icon">✓</div>

          <p className="eyebrow">REGISTRATION SUCCESSFUL</p>

          <h1>Welcome Back, Classmate!</h1>

          <p>
            Your registration for the <strong>Class of 2021 5th Anniversary
            Reunion</strong> has been received successfully.
          </p>

          <div className="class-id-box">
            <span>Your Classmate ID</span>
            <strong>{classId}</strong>
          </div>

          <p className="small-note">
            Please keep this Classmate ID safe. It will be useful for your
            reunion registration, digital pass and check-in.
          </p>

          <Link to="/" className="primary-button">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-page">
      <div className="registration-container">

        <div className="registration-header">
          <Link to="/" className="back-link">
            ← Back to Home
          </Link>

          <p className="eyebrow">CLASS OF 2021</p>

          <h1>Reunion Registration</h1>

          <p>
            Let's reconnect, celebrate our journey and create new memories
            together.
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="registration-form">

          {/* PERSONAL INFORMATION */}

          <section className="form-section">
            <div className="section-heading">
              <span>01</span>
              <div>
                <h2>Personal Information</h2>
                <p>Tell us who you are.</p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group full-width">
                <label>
                  Full Name *
                </label>

                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Nickname</label>

                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="What did we call you?"
                />
              </div>

              <div className="form-group">
                <label>Phone / WhatsApp *</label>

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="024 XXX XXXX"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Email Address</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                />
              </div>

            </div>
          </section>


          {/* CLASS INFORMATION */}

          <section className="form-section">
            <div className="section-heading">
              <span>02</span>

              <div>
                <h2>Class Information</h2>
                <p>Help us identify you from our class records.</p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group">
                <label>Class / Stream</label>

                <input
                  type="text"
                  name="class_stream"
                  value={formData.class_stream}
                  onChange={handleChange}
                  placeholder="e.g. 3A12"
                />
              </div>

              <div className="form-group">
                <label>SHS House</label>

                <input
                  type="text"
                  name="shs_house"
                  value={formData.shs_house}
                  onChange={handleChange}
                  placeholder="Enter your house"
                />
              </div>

            </div>
          </section>


          {/* CURRENT INFORMATION */}

          <section className="form-section">
            <div className="section-heading">
              <span>03</span>

              <div>
                <h2>Life After SHS</h2>
                <p>Let's see where life has taken you.</p>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group">
                <label>Occupation / Profession</label>

                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  placeholder="e.g. Software Developer"
                />
              </div>

              <div className="form-group">
                <label>Organization / Business</label>

                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder="Company or business name"
                />
              </div>

              <div className="form-group full-width">
                <label>Current Location</label>

                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Accra, Ghana"
                />
              </div>

            </div>
          </section>


          {/* REUNION */}

          <section className="form-section">
            <div className="section-heading">
              <span>04</span>

              <div>
                <h2>Reunion Details</h2>
                <p>Help us prepare for your attendance.</p>
              </div>
            </div>

            <div className="form-group">

              <label>Will you attend the reunion? *</label>

              <div className="radio-group">

                <label className="radio-option">
                  <input
                    type="radio"
                    name="attending"
                    value="true"
                    checked={formData.attending === true}
                    onChange={() =>
                      setFormData((previous) => ({
                        ...previous,
                        attending: true,
                      }))
                    }
                  />
                  <span>Yes, I'll be there 🎉</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="attending"
                    value="false"
                    checked={formData.attending === false}
                    onChange={() =>
                      setFormData((previous) => ({
                        ...previous,
                        attending: false,
                      }))
                    }
                  />
                  <span>Unfortunately, I can't make it</span>
                </label>

              </div>

            </div>


            {formData.attending && (
              <div className="form-grid reunion-fields">

                <div className="form-group">
                  <label>Number of Guests</label>

                  <select
                    name="guests"
                    value={formData.guests}
                    onChange={handleChange}
                  >
                    <option value="0">Just me</option>
                    <option value="1">1 guest</option>
                    <option value="2">2 guests</option>
                    <option value="3">3 guests</option>
                    <option value="4">4 guests</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>T-Shirt Size</label>

                  <select
                    name="tshirt_size"
                    value={formData.tshirt_size}
                    onChange={handleChange}
                  >
                    <option value="">Select size</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="XXXL">XXXL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>T-Shirt Quantity</label>

                  <input
                    type="number"
                    name="tshirt_quantity"
                    min="0"
                    max="10"
                    value={formData.tshirt_quantity}
                    onChange={handleChange}
                  />
                </div>

              </div>
            )}
          </section>


          {/* MEMORIES */}

          <section className="form-section">
            <div className="section-heading">
              <span>05</span>

              <div>
                <h2>Memory Lane</h2>
                <p>Give us something to remember.</p>
              </div>
            </div>

            <div className="form-group full-width">

              <label>
                What is your favourite memory from SHS?
              </label>

              <textarea
                name="favourite_memory"
                value={formData.favourite_memory}
                onChange={handleChange}
                placeholder="Tell us about a funny, memorable or unforgettable moment..."
                rows="5"
              />

            </div>
          </section>


          {/* CONSENT */}

          <section className="consent-section">

            <label className="consent-option">

              <input
                type="checkbox"
                name="privacy_consent"
                checked={formData.privacy_consent}
                onChange={handleChange}
              />

              <span>
                I consent to my information being used for organizing the
                Class of 2021 reunion and related class activities. My
                information will not be publicly displayed without my
                permission. *
              </span>

            </label>

          </section>


          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? "Submitting Registration..." : "Complete Registration →"}
          </button>

        </form>

      </div>
    </div>
  );
}
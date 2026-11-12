import React, { useState } from "react";
import axios from "axios";
import styles from "../AuthComponent/AuthForm.module.css";
import AuthLayout from "../AuthComponent/AuthForm";

// Sends a password reset link to the email (the answer is the same whether or not the account exists)
function ForgotPassword({ onBack, toggleForm }) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post("/auth/forgot-password", { email });
            setMessage(res.data.message);
        } catch (err) {
            setMessage(err.response?.data?.message || "Could not send the link. Try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout onCreateAccount={toggleForm || onBack}>
            <form className={styles.formContainer} onSubmit={handleEmailSubmit}>
                <div className={styles.field}>
                    <label htmlFor="reset-email">Email</label>
                    <input
                        id="reset-email"
                        type="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                {message && <p role="status" style={{ margin: 0, color: "#fff" }}>{message}</p>}

                <div className={styles.actionsRow}>
                    <button type="submit" className={styles.primaryBtn} disabled={loading}>
                        {loading ? "Sending..." : "Send mail"}
                    </button>
                    <button type="button" className={styles.primaryBtn} onClick={onBack}>
                        Back
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}

export default ForgotPassword;

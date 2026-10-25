import React from "react";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
// import "./../styles/ForgotPassword.css";
import HandymanLogo from "../assets/handyman_fakeLogo.png";

function ForgotPassword() {
  return (
    <div className="forgot-password-container">
      <div className="row vh-100">
        <div className="col-md-6 d-flex align-items-center justify-content-center mx-auto">
          <div className="forgot-password-box text-center">
            <img src={HandymanLogo} alt="Handyman Logo" width="150" className="mx-auto d-block mb-4" />
            <h3 className="mb-3">Contact Help</h3>
            <p className="text-muted mb-4">
              If you have forgotten your password, please contact the Admin for assistance.
            </p>
            <Link to="/" className="btn btn-primary w-100">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
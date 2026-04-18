// src/context/UserContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";
import { auth, database } from "../firebase";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        return;
      }

      try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, "admin"));
        if (!snapshot.exists()) {
          setCurrentUser(null);
          return;
        }
        const admins = snapshot.val();
        const adminList = Object.entries(admins)
          .filter(([key]) => key !== "test")
          .map(([id, data]) => ({ id, ...data }));
        const profile = adminList.find((u) => u.email === firebaseUser.email);

        if (!profile) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser(profile);
        localStorage.setItem("currentUser", JSON.stringify(profile));
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userRole", profile.role);
      } catch (err) {
        console.error("Failed to load admin profile:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userRole");
    setCurrentUser(null);
    navigate("/");
  }, [navigate]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

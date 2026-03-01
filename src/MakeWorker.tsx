import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase'; // Adjust if path is different
import { useAuth } from './contexts/AuthContext';

export default function MakeWorker() {
    const { user } = useAuth();

    // We update the user uid FsEHjpyR3PTF8lXvC7f67oH5QHD2
    const handleMakeWorker = async () => {
        try {
            await updateDoc(doc(db, "users", "FsEHjpyR3PTF8lXvC7f67oH5QHD2"), {
                roles: ["sanitation_worker"]
            });
            alert("SUCCESS");
        } catch (e) {
            console.error(e);
            alert("ERROR " + e);
        }
    };

    return (
        <div className="p-10">
            <h1>Make Worker Page</h1>
            <p>Logged in as: {user?.uid}</p>
            <button onClick={handleMakeWorker} className="bg-blue-500 text-white p-3 rounded mt-4">Make FsEHjpyR3PTF8lXvC7f67oH5QHD2 Worker</button>
        </div>
    )
}

import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import apiService from '../services/conferences/conferenceAPI';
import './HomePage.css';

interface JoinFormData {
  meetingId: string;
}

const HomePage: React.FC = () => {
  const [joinFormData, setJoinFormData] = useState<JoinFormData>({ meetingId: '' });
  const [error, setError] = useState<string | null>(null);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleJoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJoinFormData({ meetingId: e.target.value });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {    
      // Verify meeting ID exists (optional, depends on server)
      await apiService.get(`/meetings/${joinFormData.meetingId}`);
      navigate(`/meeting/${joinFormData.meetingId}`);
    } catch (err) {
      setError('Invalid meeting ID');
    }
  };

  const handleStartMeeting = async () => {
    try {
     
      const response = await apiService.post('/meetings', { userId: user.id });
      const { meetingId } = response;
      navigate(`/meeting/${meetingId}`);
    } catch (err) {
      setError('Failed to start meeting');
    }
  };

  return (
    <div className="home-page">
      <h1>Welcome, {user.username}</h1>
      <div className="meeting-actions">
        <div className="start-meeting">
          <button onClick={handleStartMeeting} className="start-button">
            Start New Meeting
          </button>
        </div>
        <div className="join-meeting">
          <h2>Join Meeting</h2>
          <form onSubmit={handleJoinSubmit} className="join-form">
            <div className="form-group">
              <label htmlFor="meetingId">Meeting ID</label>
              <input
                type="text"
                id="meetingId"
                name="meetingId"
                value={joinFormData.meetingId}
                onChange={handleJoinChange}
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="join-button">
              Join
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
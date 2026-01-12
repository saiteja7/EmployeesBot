import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeDashboard from './components/EmployeeDashboard';
import SearchFilter from './components/SearchFilter';
import BotChat from './components/BotChat';

function App() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/employees');
      setEmployees(res.data);
      setFilteredEmployees(res.data);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  const handleSearch = ({ skills, position }) => {
    let result = employees;

    if (skills) {
      const skillsList = skills.toLowerCase().split(',').map(s => s.trim());
      result = result.filter(emp => {
        // Handle both 'skills' and 'Skills' field names
        const empSkills = emp.Skills || emp.skills || '';
        const skillsArray = Array.isArray(empSkills) ? empSkills : empSkills.split(',').map(s => s.trim());
        return skillsList.some(skill =>
          skillsArray.some(es => es.toLowerCase().includes(skill))
        );
      });
    }

    if (position) {
      result = result.filter(emp =>
        (emp.position || emp['Company Level'] || '').toLowerCase().includes(position.toLowerCase())
      );
    }

    setFilteredEmployees(result);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus('Uploading...');
      await axios.post('http://localhost:3000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus('Upload successful! You can now ask the bot about this data.');
      // Refresh employees after upload
      await fetchEmployees();
    } catch (err) {
      console.error("Upload failed", err);
      setUploadStatus('Upload failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-primary mb-2">IEBA System</h1>
        <p className="text-secondary text-lg">Intelligent Employee & Billing Analyst</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">

          {/* File Upload Section */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 text-primary">Data Management</h2>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-violet-50 file:text-violet-700
                  hover:file:bg-violet-100"
              />
              {uploadStatus && <span className="text-sm font-medium text-green-600">{uploadStatus}</span>}
            </div>
          </section>

          {/* Search & Dashboard */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-primary">Employee Directory</h2>
            <SearchFilter onSearch={handleSearch} />
            <EmployeeDashboard employees={filteredEmployees} />
          </section>
        </div>

        {/* Sidebar / Bot Area */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <BotChat />
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
              <p><strong>Tip:</strong> Upload the billing Excel file to enable the bot's analysis features.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

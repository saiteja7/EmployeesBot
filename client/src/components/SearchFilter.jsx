import React from 'react';

const SearchFilter = ({ onSearch }) => {
    const [skills, setSkills] = React.useState('');
    const [position, setPosition] = React.useState('');

    const handleSearch = () => {
        onSearch({ skills, position });
    };

    return (
        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white shadow rounded-lg items-end">
            <div className="flex-1 w-full">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="skills">
                    Skills (comma separated)
                </label>
                <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id="skills"
                    type="text"
                    placeholder="e.g. Java, React"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                />
            </div>
            <div className="flex-1 w-full">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="position">
                    Position/Level
                </label>
                <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id="position"
                    type="text"
                    placeholder="e.g. 3P"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                />
            </div>
            <button
                className="bg-accent hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline h-10"
                onClick={handleSearch}
            >
                Search
            </button>
        </div>
    );
};

export default SearchFilter;

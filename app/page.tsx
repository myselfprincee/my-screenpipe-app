"use client";

import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { LaunchWhatsappChromeSession } from "./launch-whatsapp-web-chrome-session";
import { ReloadButton } from "./reload-button";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

interface Pipe {
  id: string;
  name: string;
  description: string;
}

export default function Page() {
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginStatus, setLoginStatus] = useState<'checking' | 'logged_in' | 'logged_out' | null>(null);
  const [messageData, setMessageData] = useState([] || localStorage.getItem('messageData'));
  const typeofData = ['promotional', 'spam'];
  const [filteredContent, setFilteredContent] = useState([]);
  const [selectMultiple, setSelectMultiple] = useState([]);
  const [showCheckbox, setShowCheckbox] = useState<boolean>(false);

  useEffect(() => {
    fetch("https://screenpi.pe/api/plugins/registry")
      .then((res) => res.json())
      .then((data) => {
        const transformedPipes = data.map((pipe: any) => ({
          id: pipe.id,
          name: pipe.name,
          description: pipe.description?.split("\n")[0] || "",
        }));
        setPipes(transformedPipes);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching pipes:", error);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-5 flex flex-col items-center">
      <h1 className="text-center text-5xl font-extrabold text-gray-900 mb-6">Messages Filter</h1>
      <LaunchWhatsappChromeSession loginStatus={loginStatus} setLoginStatus={setLoginStatus} />
      <ReloadButton />
      <button
        className="bg-blue-600 text-white rounded-full py-2 px-5 hover:bg-blue-700 transition-all shadow-lg"
        onClick={() => {
          setLoading(true);
          fetch("/api/readmsg")
            .then(res => res.json())
            .then(data => {
              setMessageData(data.classifications);
              localStorage.setItem("messageData", messageData);
              setLoading(false);
            })
            .catch(err => {
              console.error("Error fetching messages:", err);
              setLoading(false);
            });
        }}
      >
        {loading ? "Loading..." : "Get Chats"}
      </button>

      <div className="grid grid-cols-2 gap-5 mt-8 w-full max-w-4xl">
        {typeofData.map((item, index) => {
          const filter = messageData.filter((msg) => msg.category === item);
          return (
            <div key={index} className="p-6 bg-white shadow-xl rounded-2xl border text-center transform hover:scale-105 transition">
              <h3 className="text-xl font-semibold text-gray-900">{item.toUpperCase()}</h3>
              <p className="text-blue-600 text-3xl font-bold my-3">{filter.length}</p>
              <button
                onClick={() => setFilteredContent(filter)}
                className="px-5 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition"
              >
                View
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="bg-red-500 text-white py-2 px-4 rounded-full mt-6 hover:bg-red-600 transition shadow-lg"
        onClick={() => {
          setShowCheckbox(!showCheckbox);
          if (!showCheckbox) setSelectMultiple([]);
        }}
      >
        {showCheckbox ? "Cancel Selection" : "Select Multiple"}
      </button>

      {selectMultiple.length > 0 ? (
        <button
          onClick={() => {
            fetch('/api/deletemsg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(selectMultiple),
            })
              .then(response => response.json())
              .then(data => {
                setFilteredContent(filteredContent.filter(msg => !selectMultiple.includes(msg.name)));
              })
              .catch(error => console.error('Error deleting message:', error));
          }}
          className="px-4 mt-4 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition"
        >
          Delete Selected
        </button>
      ) : null}

      <div className="max-w-2xl w-full mt-8 p-6 bg-gray-100 rounded-xl shadow-lg">
        {filteredContent.map((user, index) => (
          <div key={index} className={`p-4 my-3 rounded-lg shadow-md flex items-center justify-between ${index % 2 === 0 ? "bg-blue-100" : "bg-gray-200"}`}>
            {showCheckbox && (
              <input
                type="checkbox"
                checked={selectMultiple.includes(user.name)}
                onChange={(e) => {
                  setSelectMultiple(e.target.checked
                    ? [...selectMultiple, user.name]
                    : selectMultiple.filter(name => name !== user.name)
                  );
                }}
                className="mr-3"
              />
            )}
            <span className="font-semibold text-gray-900 flex-1">{user.name}</span>
            <span className="text-gray-700 flex-1">{user.message}</span>
            <button
              onClick={() => {
                fetch('/api/deletemsg', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: user.name }),
                })
                  .then(response => response.json())
                  .then(() => {
                    setMessageData(prevData => prevData.filter(msg => msg.name !== user.name));
                    setFilteredContent(prevData => prevData.filter(msg => msg.name !== user.name));
                  })
                  .catch(error => console.error('Error deleting message:', error));
              }}
              className="ml-4 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
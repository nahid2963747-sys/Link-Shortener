const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// ==========================================
// ১. ডাটাবেস কানেকশন (MongoDB)
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error: ", err));

const Link = mongoose.models.Link || mongoose.model('Link', new mongoose.Schema({
  originalUrl: String,
  shortCode: String
}));

// ==========================================
// ২. টেলিগ্রাম বট ও অ্যাডমিন API (লিংক শর্ট করার জন্য)
// ==========================================
app.post('/api/shorten', async (req, res) => {
  const { url } = req.body;
  const shortCode = Math.random().toString(36).substring(2, 8); // ৬ ডিজিট কোড
  await Link.create({ originalUrl: url, shortCode });
  
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  res.json({ shortUrl: `${protocol}://${host}/${shortCode}` });
});

// ==========================================
// ৩. অ্যাডমিন প্যানেল UI (HTML & JS)
// ==========================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Panel</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 flex items-center justify-center min-h-screen">
      <div class="bg-white p-8 rounded shadow-md w-96">
        <h1 class="text-2xl font-bold mb-4 text-center">Admin Panel</h1>
        <input id="url" type="text" placeholder="Enter Long URL here..." class="w-full p-3 border rounded mb-4"/>
        <button onclick="shortenLink()" class="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold">Shorten Link</button>
        <div id="result" class="mt-4 font-bold text-green-600 text-center text-lg"></div>
      </div>
      <script>
        async function shortenLink() {
          const url = document.getElementById('url').value;
          if(!url) return alert("Please enter a URL!");
          document.getElementById('result').innerText = "Generating...";
          const res = await fetch('/api/shorten', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url})
          });
          const data = await res.json();
          document.getElementById('result').innerText = data.shortUrl;
        }
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// ৪. ইউজারদের জন্য মেইন পেজ (টাইমার, স্টেপ, অটো-স্ক্রল)
// ==========================================
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  const linkData = await Link.findOne({ shortCode: code });
  
  if (!linkData) return res.status(404).send("<h1>Link Not Found!</h1>");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Please wait...</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 flex flex-col items-center pb-20">
      
      <!-- উপরের অ্যাড -->
      <div class="w-full max-w-4xl h-24 bg-gray-300 mt-5 flex items-center justify-center font-bold text-gray-500">Ad Space 1</div>
      
      <h1 id="step-text" class="text-3xl font-bold mt-10">Step 1 of 3</h1>
      <p class="mt-2 text-gray-600 font-bold">Please wait for the timer...</p>

      <!-- লম্বা কন্টেন্ট (যাতে স্ক্রল করতে হয়) -->
      <div class="h-[1200px] w-full max-w-4xl bg-white border-2 border-dashed border-gray-300 my-10 flex items-center justify-center text-gray-400">[ Write Long Articles or Put AdSense/Propeller Ads Here ]
      </div>

      <!-- ম্যাজিক বাটন -->
      <div class="mt-5">
        <button id="timer-btn" class="px-10 py-4 bg-gray-400 text-white font-bold rounded cursor-not-allowed">
          Please wait 15 seconds...
        </button>
      </div>

      <script>
        // সেটিং কন্ট্রোল (এখান থেকে চেঞ্জ করতে পারবেন)
        let totalSteps = 3; 
        let defaultTimer = 15; 
        
        let currentStep = 1;
        let timeLeft = defaultTimer;
        let timerBtn = document.getElementById('timer-btn');
        let stepText = document.getElementById('step-text');
        const finalUrl = "${linkData.originalUrl}"; // ডাটাবেস থেকে পাওয়া আসল লিংক

        function startTimer() {
          timeLeft = defaultTimer;
          timerBtn.className = "px-10 py-4 bg-gray-400 text-white font-bold rounded cursor-not-allowed";
          timerBtn.innerText = "Please wait " + timeLeft + " seconds...";
          timerBtn.onclick = null;

          let interval = setInterval(() => {
            timeLeft--;
            if(timeLeft > 0) {
              timerBtn.innerText = "Please wait " + timeLeft + " seconds...";
            } else {
              // টাইমার জিরো হলে যা হবে:
              clearInterval(interval);
              timerBtn.className = "px-10 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded animate-bounce cursor-pointer";
              timerBtn.innerText = currentStep === totalSteps ? "Get Final Link" : "Scroll Down & Click Next";
              
              // অটো-স্ক্রল (Auto-scroll to button)
              timerBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
              
              timerBtn.onclick = () => {
                if(currentStep < totalSteps) {
                  currentStep++;
                  stepText.innerText = "Step " + currentStep + " of " + totalSteps;
                  window.scrollTo({ top: 0, behavior: 'smooth' }); // স্ক্রল করে উপরে যাবে
                  startTimer(); // আবার টাইমার শুরু
                } else {
                  window.location.href = finalUrl; // আসল লিংকে রিডাইরেক্ট
                }
              };
            }
          }, 1000); // 1000ms = 1s
        }

        startTimer(); // পেজ লোড হলেই টাইমার শুরু
      </script>
    </body>
    </html>
  `);
});

// Vercel এর জন্য এক্সপোর্ট
module.exports = app;

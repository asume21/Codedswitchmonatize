import dotenv from "dotenv";
dotenv.config();

async function testLogin() {
  console.log("Testing login endpoint...");
  
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "servicehelp@codedswitch.com",
        password: "test123"  // dummy password to see what error we get
      }),
    });
    
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    
    const text = await res.text();
    console.log("Body:", text);
    
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log("Parsed JSON:", json);
      } catch {
        console.log("Body is NOT valid JSON");
      }
    } else {
      console.log("Body is EMPTY - this is the bug!");
    }
  } catch (e: any) {
    console.log("Fetch error:", e.message);
  }
}

testLogin();

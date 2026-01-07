require('dotenv').config();
const express= require('express');
const app = express()
const { query, validationResult } = require("express-validator");
const fetch = require('node-fetch');
const path = require('path');





app.set("view engine","ejs");
// Ensure views and static paths are correctly resolved
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));

// Prevent caching on dynamic pages
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});


app.get('/',(req,res)=>{

    res.render("index",{ results: null, error: null, message: null, currentPage: 1, totalPages: 1, queryText: "", selectedLanguage: ""});
})

// this part here is for creating the github serach code api query
app.get('/search',
     [
    query("q")
      .trim()
      .notEmpty()
      .withMessage("Search query is required")
      .isLength({ max: 256 })
      .withMessage("Query too long")
      .matches(/^[\w.\s]+$/)
      .withMessage("Invalid characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("index", {
        results: null,
        error: errors.array()[0].msg,
        message: null,
        currentPage: 1,
        totalPages: 1,
        queryText: "",
        selectedLanguage: ""
      });
    }
    // now using the api directly to retrive the data.
    try {
        const userInput = req.query.q;
        const selectedLanguage = req.query.language;
        const tokens = userInput.split(/\s+/);
        
        // yaha main language filter ka use karke uss particular language ki querry bana rha hu 
        let githubQuery = tokens.join(" ");
        if (selectedLanguage) {
          githubQuery += ` language:${selectedLanguage}`;
        }
        
        const encodedQuery = encodeURIComponent(githubQuery.trim());
        const per_page = 10;
        const page = parseInt(req.query.page)|| 1;
        const url =`https://api.github.com/search/code?q=${encodedQuery}&per_page=${per_page}&page=${page}`;
       
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json'
            }
        });

        if(response.status==403){
             return res.render("index", {
          results: null,
          error: "GitHub rate limit exceeded",
          message: null,
          currentPage: page,
          totalPages: 1,
          queryText: userInput,
          selectedLanguage: selectedLanguage || ""
        });
        }
// data variable main fetched data dala and then use ejs page pe render kar diya .
        const data = await response.json();
        const totalCount = data.total_count || 0;
        const totalPages = Math.ceil(totalCount / per_page);
        const results = (data.items || []).map((item) => ({
        repo: item.repository.full_name,
        file: item.name,
        path: item.path,
        url: `/code?owner=${item.repository.owner.login}&repo=${item.repository.name}&path=${encodeURIComponent(item.path)}`,
        user: item.repository.owner.login,
      }));
      let message = null;
      if(results.length==0){
        message = "no result found for this search";
      }
      // Adding query and page to each result link
      const resultsWithParams = results.map(item => ({
        ...item,
        url: `${item.url}&q=${encodeURIComponent(userInput)}&page=${page}${selectedLanguage ? '&language=' + selectedLanguage : ''}`
      }));
        res.render("index", { 
          results: resultsWithParams,
          message, 
          error: null,
        currentPage: page,
        totalPages,
        queryText: userInput,
        selectedLanguage: selectedLanguage || "" });

    } catch (err) {
      res.render("index", {
        results: null,
        error: "Failed to fetch data from GitHub",
        message: null,
        currentPage: 1,
        totalPages: 1,
        queryText: req.query.q || "",
        selectedLanguage: req.query.language || ""
      });
    }

});

app.get('/code', async (req, res) => {
    const { owner, repo, path, q, page, language } = req.query;

    if (!owner || !repo || !path) {
        return res.send("Missing required parameters.");
    }

    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json'
            }
        });

        if (response.status === 403) {
            return res.send("GitHub rate limit exceeded");
        }

        const data = await response.json();

        if (!data.content) {
            return res.send("Could not fetch code content");
        }

        // Decode base64
        const buffer = Buffer.from(data.content, 'base64');
        const code = buffer.toString('utf-8');

        res.render("codeview", { 
            code, 
            fileName: path, 
            repo, 
            owner, 
            query: q || '', 
            page: page || 1,
            language: language || ''
        });

    } catch (err) {
        res.send("Failed to fetch code from GitHub");
    }
});



console.log(process.env.GITHUB_TOKEN ? "not missing" : "missing")

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
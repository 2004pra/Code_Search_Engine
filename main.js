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

// Function for parsing the repos input
function parseInput(input) {
  const repos = [];
  // lines main se comma, spaces remove kar diye
  const lines = input.split(/[\n,]+/).filter(line => line.trim());
  lines.forEach(line => {
    line = line.trim();
    // yaha se ham github ke url format se owner/repo format main convert karte hai
    const urlMatch = line.match(/(?:https?:\/\/)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)/);

    if (urlMatch) {
      repos.push(`${urlMatch[1]}/${urlMatch[2]}`);
    } else if (line.match(/^[\w.-]+\/[\w.-]+$/)) {
      repos.push(line);
    }
  });
  return [...new Set(repos)];
}

app.get('/',(req,res)=>{

    res.render("index",{ results: null, error: null, message: null, currentPage: 1, totalPages: 1, queryText: "", selectedLanguage: "", reposText: ""});
})

app.get('/about',(req,res)=>{
    res.render("about");
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
        selectedLanguage: "",
        reposText:""
      });
    }

    // now using the api directly to retrive the data.
    try {
        const userInput = req.query.q;
        const selectedLanguage = req.query.language;
        const reposInput = req.query.repos;
        const tokens = userInput.split(/\s+/);
        
        // yaha main language filter ka use karke uss particular language ki querry bana rha hu 
        let githubQuery = tokens.join(" ");
        if (selectedLanguage) {
          githubQuery += ` language:${selectedLanguage}`;
        }
        if(reposInput && reposInput.trim()){
          const repos = parseInput(reposInput);

          if(repos && repos.length>0){
            repos.forEach(repo=>{
              githubQuery += ` repo:${repo}`;
            });
          }
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
          error: "GitHub API rate limit exceeded. Please try again later.",
          message: null,
          currentPage: page,
          totalPages: 1,
          queryText: userInput,
          selectedLanguage: selectedLanguage || "",
          reposText : reposInput || ""
        });
        }
// data variable main fetched data dala and then use ejs page pe render kar diya .
        const data = await response.json();
        const totalCount = data.total_count || 0;
        const totalPages = Math.ceil(totalCount / per_page);
        
        // Fetch repo details for each result (stars, language, etc.)
        const resultsWithDetails = await Promise.all((data.items || []).map(async (item) => {
          try {
            const repoResponse = await fetch(`https://api.github.com/repos/${item.repository.full_name}`, {
              headers: {
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json'
              }
            });
            
            const repoData = await repoResponse.json();
            
            // Fetch code content for preview
            let codePreview = '';
            try {
              const codeResponse = await fetch(`https://api.github.com/repos/${item.repository.full_name}/contents/${encodeURIComponent(item.path)}`, {
                headers: {
                  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                  Accept: 'application/vnd.github+json'
                }
              });
              
              if (codeResponse.ok) {
                const codeData = await codeResponse.json();
                if (codeData.content) {
                  const fullCode = Buffer.from(codeData.content, 'base64').toString('utf-8');
                  const lines = fullCode.split('\n');
                  // Get first 6 lines for preview
                  codePreview = lines.slice(0, 6).join('\n');
                }
              }
            } catch (codeErr) {
              // If code fetch fails, just continue without preview
              codePreview = '';
            }
            
            return {
              repo: item.repository.full_name,
              file: item.name,
              path: item.path,
              url: `/code?owner=${item.repository.owner.login}&repo=${item.repository.name}&path=${encodeURIComponent(item.path)}`,
              user: item.repository.owner.login,
              stars: repoData.stargazers_count || 0,
              forks: repoData.forks_count || 0,
              language: repoData.language || 'Unknown',
              description: repoData.description || '',
              codePreview: codePreview
            };
          } catch (err) {
            // If repo details fetch fails, return without stats
            return {
              repo: item.repository.full_name,
              file: item.name,
              path: item.path,
              url: `/code?owner=${item.repository.owner.login}&repo=${item.repository.name}&path=${encodeURIComponent(item.path)}`,
              user: item.repository.owner.login,
              stars: 0,
              forks: 0,
              language: 'Unknown',
              description: '',
              codePreview: ''
            };
          }
        }));
        
      let message = null;
      if(resultsWithDetails.length==0){
        message = "No results found for your search.";
      }
      // Adding query and page to each result link
      const resultsWithParams = resultsWithDetails.map(item => ({
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
        selectedLanguage: selectedLanguage || "",
      reposText: reposInput || "" });

    } catch (err) {
      res.render("index", {
        results: null,
        error: "Failed to fetch data from GitHub",
        message: null,
        currentPage: 1,
        totalPages: 1,
        queryText: req.query.q || "",
        selectedLanguage: req.query.language || "",
        reposText : req.query.repos || ""
      });
    }

});

app.get('/code', async (req, res) => {
    const { owner, repo, path: filePath, q, page, language } = req.query;

    if (!owner || !repo || !filePath) {
        return res.send("Missing required parameters.");
    }

    try {
        // Fetch the code file
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
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

        res.render("codeView", { 
            code, 
            fileName: filePath, 
            repo, 
            owner, 
            query: q || '', 
            page: page || 1,
            language: language || '',
            reposText: ""
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
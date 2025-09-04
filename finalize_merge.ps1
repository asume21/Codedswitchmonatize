# 1. Show current status (conflicted files will be listed)
git status

# 2. (You must manually resolve conflicts in your editor before continuing!)
Write-Host ""
Write-Host "Please resolve all merge conflicts in your listed files before running the next steps."
Write-Host "Once you've done that, press ENTER to continue..."
Read-Host

# 3. Add all files (including resolved conflicts)
git add .

# 4. Commit the merge resolution
git commit -m "Resolve merge conflicts and update main"

# 5. Pull latest from origin/main using rebase (to avoid non-fast-forward errors)
git pull origin main --rebase

# 6. Push your changes to GitHub
git push origin main

Write-Host "Done! Your conflicts are resolved, committed, and pushed."
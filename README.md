# Neet Jain — 3D Portfolio

A one-page portfolio with an interactive 3D avatar, built with plain HTML/CSS/JS,
[Three.js](https://threejs.org) and [GSAP](https://gsap.com). No build step.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. (The page must be served over HTTP; opening
`index.html` directly from Finder won't load the JS modules.)

## Files

| File | What's in it |
| --- | --- |
| `index.html` | All the content: hero, about, what I do, career, work, leadership, toolkit, contact |
| `css/style.css` | Styles and the mobile layout |
| `js/scene.js` | Loads the 3D character, lights, head-follows-cursor, brow raise on hover, scroll choreography |
| `models/`, `draco/` | The character model, environment map and mesh decoder |
| `js/main.js` | Loader, scroll animations, cursor, rotating role text |
| `Neet_Jain_UK_CV.pdf` | The résumé linked from the site |

## Credits

The 3D character, its rig and animations come from
[akashrmalhotra/3d-portfolio](https://github.com/akashrmalhotra/3d-portfolio), MIT-licensed
(see `models/LICENSE-character.txt`). Keep that notice if you publish the site.

## Deploy (free)

- **Netlify:** drag this folder onto https://app.netlify.com/drop
- **Vercel / GitHub Pages:** push the folder to a GitHub repo and import it. There's no build command, and the output directory is the repo root.

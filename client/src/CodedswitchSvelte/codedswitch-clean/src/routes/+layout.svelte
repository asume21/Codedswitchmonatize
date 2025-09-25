<script>
  import '../app.css';
</script>

<main>
  <slot />
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(html, body, #svelte) {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  main {
    height: 100vh;
    width: 100vw;
  }
</style>

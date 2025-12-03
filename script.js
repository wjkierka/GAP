// Kod ten jest wykonywany w przeglądarce użytkownika
document.getElementById('main-button').addEventListener('click', function() {
    let output = document.getElementById('output-message');
    let clicks = parseInt(output.dataset.clicks || 0) + 1; // Zliczanie kliknięć


    output.textContent = "Kliknięto przycisk " + clicks + " razy!";
    output.dataset.clicks = clicks;
});
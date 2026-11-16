// Configuração da votação no telemóvel.
// Cola em "firebase" o objeto firebaseConfig do projeto (Firebase → Definições do projeto → As tuas apps).
// Enquanto estiver a null, a votação funciona em modo local: a apresentação e a página
// do telemóvel abertas em separadores do mesmo browser, só para ensaiar.
window.VOTACAO_CONFIG = {
  // Estes dados identificam o projeto e podem ser públicos: quem protege a base de dados são as regras
  firebase: {
    apiKey: 'AIzaSyDdxswg-XNnuGOFE7xJQp4TufhE25o_I9g',
    authDomain: 'guardians-of-the-galaxy-d8b9e.firebaseapp.com',
    databaseURL: 'https://guardians-of-the-galaxy-d8b9e-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'guardians-of-the-galaxy-d8b9e',
    storageBucket: 'guardians-of-the-galaxy-d8b9e.firebasestorage.app',
    messagingSenderId: '627512417023',
    appId: '1:627512417023:web:0535f83761d17d1d910aca'
  },
  // Segundos para responder a cada pergunta (no máximo 11: as regras da base de dados fecham aos 12)
  duracao: 8
};

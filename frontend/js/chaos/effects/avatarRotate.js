export default {
  name: 'avatarRotate',
  targets: 'image',
  density: 1,
  apply(el) {
    el.classList.add('fx-avatar-rotate');
    el.addEventListener('click', () => {
      el.classList.remove('fx-avatar-rotate');
      el.classList.add('fx-backflip');
      setTimeout(() => {
        el.classList.remove('fx-backflip');
        el.classList.add('fx-avatar-rotate');
      }, 600);
    });
  },
};

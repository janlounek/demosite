
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      dataLayer.push({
        'event': 'form_submit',
        'form': 'contact',
        'formData': {
          'name': form.name.value,
          'email': form.email.value
        }
      });
      alert("Form submitted! Check the console for dataLayer event.");
      console.log("Form submitted!", form.name.value, form.email.value);
    });
  }
});

(() => {
 const AUTH_API_BASE = "https://stud-ying-production.up.railway.app";

  const studyingToken =
    localStorage.getItem("studyingToken");

  if (!studyingToken) {
    window.location.replace("login.html");
    return;
  }

  const originalFetch =
    window.fetch.bind(window);

  window.fetch = async function (
    resource,
    options = {}
  ) {
    const url =
      typeof resource === "string"
        ? resource
        : resource.url;

    const isBackendRequest =
      url.startsWith(AUTH_API_BASE);

    if (
      isBackendRequest &&
      studyingToken
    ) {
      const headers =
        new Headers(
          options.headers ||
          (
            resource instanceof Request
              ? resource.headers
              : undefined
          )
        );

      headers.set(
        "Authorization",
        `Bearer ${studyingToken}`
      );

      options = {
        ...options,
        headers
      };
    }

    const response =
      await originalFetch(
        resource,
        options
      );

    if (
      isBackendRequest &&
      response.status === 401
    ) {
      localStorage.removeItem(
        "studyingToken"
      );

      localStorage.removeItem(
        "studyingUser"
      );

      window.location.replace(
        "login.html"
      );
    }

    return response;
  };


  async function loadLoggedInUser() {
    try {
      const response =
        await fetch(
          `${AUTH_API_BASE}/api/auth/me`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Please log in."
        );
      }

      if (!data.user) {
        throw new Error(
          "User information not found."
        );
      }

      localStorage.setItem(
        "studyingUser",
        JSON.stringify(data.user)
      );


      const userName =
        document.getElementById(
          "userName"
        );

      if (userName) {
        userName.textContent =
          data.user.name || "Student";
      }


      const profileName =
        document.getElementById(
          "profileName"
        );

      if (profileName) {
        profileName.textContent =
          data.user.name || "Student";
      }


      const userNameClass =
        document.querySelector(
          ".user-name"
        );

      if (userNameClass) {
        userNameClass.textContent =
          data.user.name || "Student";
      }


      const userEmail =
        document.getElementById(
          "userEmail"
        );

      if (userEmail) {
        userEmail.textContent =
          data.user.email || "";
      }


      const userEmailClass =
        document.querySelector(
          ".user-email"
        );

      if (userEmailClass) {
        userEmailClass.textContent =
          data.user.email || "";
      }

    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      localStorage.removeItem(
        "studyingToken"
      );

      localStorage.removeItem(
        "studyingUser"
      );

      window.location.replace(
        "login.html"
      );
    }
  }


  function logoutStudying() {
    localStorage.removeItem(
      "studyingToken"
    );

    localStorage.removeItem(
      "studyingUser"
    );

    window.location.replace(
      "login.html"
    );
  }


  document.addEventListener(
    "DOMContentLoaded",
    () => {
      loadLoggedInUser();

      const logoutButton =
        document.getElementById(
          "logoutButton"
        );

      if (logoutButton) {
        logoutButton.addEventListener(
          "click",
          logoutStudying
        );
      }
    }
  );
})();
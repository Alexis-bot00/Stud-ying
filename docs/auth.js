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

      studyanteApplyUserProfile(
        data.user
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

  /* STUDYANTE_ACCOUNT_SETTINGS_FRONTEND_START */

  let studyanteCurrentUser = null;
  let studyanteProfilePictureFile = null;
  let studyanteRemoveProfilePicture = false;


  function studyanteInitial(name) {

    const value =
      String(
        name || "S"
      ).trim();

    return value
      ? value.charAt(0).toUpperCase()
      : "S";
  }


  function studyanteApplyUserProfile(user) {

    if (!user) {
      return;

    if (
      typeof studyanteUpdateTopProfileMenu === "function"
    ) {
      studyanteUpdateTopProfileMenu(user);
    }
}

    studyanteCurrentUser =
      user;

    localStorage.setItem(
      "studyingUser",
      JSON.stringify(user)
    );


    const name =
      user.name || "Student";

    const email =
      user.email || "";

    const picture =
      user.profilePicture || "";


    const nameNodes = [
      document.getElementById("userName"),
      document.getElementById("profileName"),
      document.querySelector(".user-name")
    ];


    nameNodes.forEach(
      node => {

        if (node) {
          node.textContent = name;
        }
      }
    );


    const emailNodes = [
      document.getElementById("userEmail"),
      document.querySelector(".user-email")
    ];


    emailNodes.forEach(
      node => {

        if (node) {
          node.textContent = email;
        }
      }
    );


    const avatarImage =
      document.getElementById(
        "profileAvatarImage"
      );

    const avatarInitial =
      document.getElementById(
        "profileAvatarInitial"
      );


    if (avatarImage && avatarInitial) {

      if (picture) {

        avatarImage.src =
          picture;

        avatarImage.hidden =
          false;

        avatarInitial.hidden =
          true;

      } else {

        avatarImage.removeAttribute(
          "src"
        );

        avatarImage.hidden =
          true;

        avatarInitial.hidden =
          false;

        avatarInitial.textContent =
          studyanteInitial(name);
      }
    }


    const settingsName =
      document.getElementById(
        "settingsProfileName"
      );

    const settingsEmail =
      document.getElementById(
        "settingsProfileEmail"
      );


    if (settingsName) {
      settingsName.value = name;
    }

    if (settingsEmail) {
      settingsEmail.value = email;
    }


    studyanteUpdateSettingsPreview(
      picture,
      name
    );
  }


  function studyanteUpdateSettingsPreview(
    picture,
    name
  ) {

    const preview =
      document.getElementById(
        "settingsProfilePreview"
      );

    const initial =
      document.getElementById(
        "settingsProfileInitial"
      );


    if (!preview || !initial) {
      return;
    }


    if (picture) {

      preview.src =
        picture;

      preview.hidden =
        false;

      initial.hidden =
        true;

    } else {

      preview.removeAttribute(
        "src"
      );

      preview.hidden =
        true;

      initial.hidden =
        false;

      initial.textContent =
        studyanteInitial(
          name ||
          studyanteCurrentUser?.name
        );
    }
  }


  function studyanteSettingsMessage(
    elementId,
    message,
    success
  ) {

    const element =
      document.getElementById(
        elementId
      );

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.classList.toggle(
      "success",
      Boolean(success)
    );

    element.classList.toggle(
      "error",
      Boolean(message) &&
      !success
    );
  }


  function openStudyanteAccountSettings() {

    const modal =
      document.getElementById(
        "accountSettingsModal"
      );

    if (!modal) {
      return;
    }


    studyanteProfilePictureFile =
      null;

    studyanteRemoveProfilePicture =
      false;


    if (studyanteCurrentUser) {

      studyanteApplyUserProfile(
        studyanteCurrentUser
      );
    }


    studyanteSettingsMessage(
      "profileSettingsMessage",
      "",
      false
    );

    studyanteSettingsMessage(
      "passwordSettingsMessage",
      "",
      false
    );


    modal.hidden =
      false;

    document.body.classList.add(
      "studyante-account-open"
    );
  }


  function closeStudyanteAccountSettings() {

    const modal =
      document.getElementById(
        "accountSettingsModal"
      );

    if (modal) {
      modal.hidden = true;
    }

    document.body.classList.remove(
      "studyante-account-open"
    );
  }


  async function saveStudyanteProfile() {

    const nameInput =
      document.getElementById(
        "settingsProfileName"
      );

    const emailInput =
      document.getElementById(
        "settingsProfileEmail"
      );

    const button =
      document.getElementById(
        "saveProfileSettings"
      );


    const name =
      String(
        nameInput?.value || ""
      ).trim();

    const email =
      String(
        emailInput?.value || ""
      ).trim();


    if (!name || !email) {

      studyanteSettingsMessage(
        "profileSettingsMessage",
        "Enter your name and email.",
        false
      );

      return;
    }


    const formData =
      new FormData();

    formData.append(
      "name",
      name
    );

    formData.append(
      "email",
      email
    );


    if (
      studyanteProfilePictureFile
    ) {

      formData.append(
        "profilePicture",
        studyanteProfilePictureFile
      );
    }


    if (
      studyanteRemoveProfilePicture
    ) {

      formData.append(
        "removeProfilePicture",
        "true"
      );
    }


    const oldText =
      button?.textContent || "";

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Saving...";
    }


    try {

      const response =
        await fetch(
          `${AUTH_API_BASE}/api/account/profile`,
          {
            method: "PATCH",
            body: formData
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.message ||
          "Could not update profile."
        );
      }


      if (data.token) {

        localStorage.setItem(
          "studyingToken",
          data.token
        );
      }


      studyanteProfilePictureFile =
        null;

      studyanteRemoveProfilePicture =
        false;


      studyanteApplyUserProfile(
        data.user
      );


      studyanteSettingsMessage(
        "profileSettingsMessage",
        "Profile updated successfully.",
        true
      );


    } catch (error) {

      studyanteSettingsMessage(
        "profileSettingsMessage",
        error.message,
        false
      );

    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          oldText;
      }
    }
  }


  async function changeStudyantePassword() {

    const currentPassword =
      document.getElementById(
        "settingsCurrentPassword"
      );

    const newPassword =
      document.getElementById(
        "settingsNewPassword"
      );

    const confirmPassword =
      document.getElementById(
        "settingsConfirmPassword"
      );

    const button =
      document.getElementById(
        "changeAccountPassword"
      );


    const current =
      currentPassword?.value || "";

    const next =
      newPassword?.value || "";

    const confirm =
      confirmPassword?.value || "";


    if (
      !current ||
      !next ||
      !confirm
    ) {

      studyanteSettingsMessage(
        "passwordSettingsMessage",
        "Complete all password fields.",
        false
      );

      return;
    }


    if (next.length < 6) {

      studyanteSettingsMessage(
        "passwordSettingsMessage",
        "New password must be at least 6 characters.",
        false
      );

      return;
    }


    if (next !== confirm) {

      studyanteSettingsMessage(
        "passwordSettingsMessage",
        "New passwords do not match.",
        false
      );

      return;
    }


    const oldText =
      button?.textContent || "";

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Changing...";
    }


    try {

      const response =
        await fetch(
          `${AUTH_API_BASE}/api/account/password`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                currentPassword:
                  current,

                newPassword:
                  next
              })
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.message ||
          "Could not change password."
        );
      }


      currentPassword.value =
        "";

      newPassword.value =
        "";

      confirmPassword.value =
        "";


      studyanteSettingsMessage(
        "passwordSettingsMessage",
        "Password changed successfully.",
        true
      );


    } catch (error) {

      studyanteSettingsMessage(
        "passwordSettingsMessage",
        error.message,
        false
      );

    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          oldText;
      }
    }
  }


  function installStudyanteAccountSettings() {

    const openButton =
      document.getElementById(
        "openAccountSettings"
      );

    const closeButton =
      document.getElementById(
        "closeAccountSettings"
      );

    const modal =
      document.getElementById(
        "accountSettingsModal"
      );

    const pictureInput =
      document.getElementById(
        "settingsProfilePicture"
      );

    const removePicture =
      document.getElementById(
        "removeSettingsProfilePicture"
      );

    const saveProfile =
      document.getElementById(
        "saveProfileSettings"
      );

    const changePassword =
      document.getElementById(
        "changeAccountPassword"
      );


    if (
      openButton &&
      !openButton.dataset.accountReady
    ) {

      openButton.dataset.accountReady =
        "true";

      openButton.addEventListener(
        "click",
        openStudyanteAccountSettings
      );
    }


    if (
      closeButton &&
      !closeButton.dataset.accountReady
    ) {

      closeButton.dataset.accountReady =
        "true";

      closeButton.addEventListener(
        "click",
        closeStudyanteAccountSettings
      );
    }


    if (
      modal &&
      !modal.dataset.accountReady
    ) {

      modal.dataset.accountReady =
        "true";

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target === modal
          ) {

            closeStudyanteAccountSettings();
          }
        }
      );
    }


    if (
      pictureInput &&
      !pictureInput.dataset.accountReady
    ) {

      pictureInput.dataset.accountReady =
        "true";


      pictureInput.addEventListener(
        "change",
        () => {

          const file =
            pictureInput.files?.[0];

          if (!file) {
            return;
          }


          if (
            ![
              "image/jpeg",
              "image/png",
              "image/webp"
            ].includes(
              file.type
            )
          ) {

            alert(
              "Choose a JPG, PNG or WEBP image."
            );

            pictureInput.value =
              "";

            return;
          }


          if (
            file.size >
            3 * 1024 * 1024
          ) {

            alert(
              "Profile picture must be 3 MB or smaller."
            );

            pictureInput.value =
              "";

            return;
          }


          studyanteProfilePictureFile =
            file;

          studyanteRemoveProfilePicture =
            false;


          const reader =
            new FileReader();

          reader.onload =
            () => {

              studyanteUpdateSettingsPreview(
                reader.result,
                studyanteCurrentUser?.name
              );
            };

          reader.readAsDataURL(
            file
          );
        }
      );
    }


    if (
      removePicture &&
      !removePicture.dataset.accountReady
    ) {

      removePicture.dataset.accountReady =
        "true";

      removePicture.addEventListener(
        "click",
        () => {

          studyanteProfilePictureFile =
            null;

          studyanteRemoveProfilePicture =
            true;

          if (pictureInput) {
            pictureInput.value = "";
          }

          studyanteUpdateSettingsPreview(
            "",
            studyanteCurrentUser?.name
          );
        }
      );
    }


    if (
      saveProfile &&
      !saveProfile.dataset.accountReady
    ) {

      saveProfile.dataset.accountReady =
        "true";

      saveProfile.addEventListener(
        "click",
        saveStudyanteProfile
      );
    }


    if (
      changePassword &&
      !changePassword.dataset.accountReady
    ) {

      changePassword.dataset.accountReady =
        "true";

      changePassword.addEventListener(
        "click",
        changeStudyantePassword
      );
    }


    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape" &&
          modal &&
          !modal.hidden
        ) {

          closeStudyanteAccountSettings();
        }
      }
    );
  }


  window.studyanteApplyUserProfile =
    studyanteApplyUserProfile;

  /* STUDYANTE_ACCOUNT_SETTINGS_FRONTEND_END */


  /* STUDYANTE_TOP_PROFILE_MENU_START */

  function studyanteSetMenuAvatar(
    imageId,
    initialId,
    user
  ) {

    const image =
      document.getElementById(
        imageId
      );

    const initial =
      document.getElementById(
        initialId
      );

    if (!image || !initial) {
      return;
    }


    const picture =
      user?.profilePicture || "";

    const name =
      user?.name || "Student";


    if (picture) {

      image.src =
        picture;

      image.hidden =
        false;

      initial.hidden =
        true;

    } else {

      image.removeAttribute(
        "src"
      );

      image.hidden =
        true;

      initial.hidden =
        false;

      initial.textContent =
        studyanteInitial(name);
    }
  }


  function studyanteUpdateTopProfileMenu(user) {

    if (!user) {
      return;
    }


    studyanteSetMenuAvatar(
      "topProfileAvatarImage",
      "topProfileAvatarInitial",
      user
    );


    studyanteSetMenuAvatar(
      "dropdownProfileAvatarImage",
      "dropdownProfileAvatarInitial",
      user
    );


    const name =
      document.getElementById(
        "dropdownProfileName"
      );

    const email =
      document.getElementById(
        "dropdownProfileEmail"
      );


    if (name) {
      name.textContent =
        user.name || "Student";
    }


    if (email) {
      email.textContent =
        user.email || "";
    }
  }


  function studyanteOpenProfileDropdown() {

    const dropdown =
      document.getElementById(
        "studyanteProfileDropdown"
      );

    const button =
      document.getElementById(
        "studyanteTopProfileButton"
      );


    if (!dropdown) {
      return;
    }


    dropdown.hidden =
      false;


    if (button) {

      button.setAttribute(
        "aria-expanded",
        "true"
      );
    }
  }


  function studyanteCloseProfileDropdown() {

    const dropdown =
      document.getElementById(
        "studyanteProfileDropdown"
      );

    const button =
      document.getElementById(
        "studyanteTopProfileButton"
      );


    if (dropdown) {

      dropdown.hidden =
        true;
    }


    if (button) {

      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }


  function studyanteToggleProfileDropdown() {

    const dropdown =
      document.getElementById(
        "studyanteProfileDropdown"
      );


    if (!dropdown) {
      return;
    }


    if (dropdown.hidden) {

      studyanteOpenProfileDropdown();

    } else {

      studyanteCloseProfileDropdown();
    }
  }


  function studyanteSyncDropdownThemeText() {

    const text =
      document.getElementById(
        "dropdownThemeText"
      );


    if (!text) {
      return;
    }


    const darkMode =
      document.body.classList.contains(
        "studyante-dark"
      );


    text.textContent =
      darkMode
        ? "Light Mode"
        : "Dark Mode";
  }


  function installStudyanteTopProfileMenu() {

    const button =
      document.getElementById(
        "studyanteTopProfileButton"
      );

    const dropdown =
      document.getElementById(
        "studyanteProfileDropdown"
      );

    const settings =
      document.getElementById(
        "dropdownAccountSettings"
      );

    const theme =
      document.getElementById(
        "dropdownThemeToggle"
      );

    const logout =
      document.getElementById(
        "dropdownLogoutButton"
      );


    if (
      button &&
      !button.dataset.profileMenuReady
    ) {

      button.dataset.profileMenuReady =
        "true";


      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          studyanteToggleProfileDropdown();
        }
      );
    }


    if (
      dropdown &&
      !dropdown.dataset.profileMenuReady
    ) {

      dropdown.dataset.profileMenuReady =
        "true";


      dropdown.addEventListener(
        "click",
        event => {

          event.stopPropagation();
        }
      );
    }


    if (
      settings &&
      !settings.dataset.profileMenuReady
    ) {

      settings.dataset.profileMenuReady =
        "true";


      settings.addEventListener(
        "click",
        () => {

          studyanteCloseProfileDropdown();

          openStudyanteAccountSettings();
        }
      );
    }


    if (
      theme &&
      !theme.dataset.profileMenuReady
    ) {

      theme.dataset.profileMenuReady =
        "true";


      theme.addEventListener(
        "click",
        () => {

          const oldThemeButton =
            document.getElementById(
              "studyanteThemeToggle"
            );


          if (oldThemeButton) {

            oldThemeButton.click();

          } else {

            document.body.classList.toggle(
              "studyante-dark"
            );
          }


          setTimeout(
            studyanteSyncDropdownThemeText,
            50
          );
        }
      );
    }


    if (
      logout &&
      !logout.dataset.profileMenuReady
    ) {

      logout.dataset.profileMenuReady =
        "true";


      logout.addEventListener(
        "click",
        logoutStudying
      );
    }


    document.addEventListener(
      "click",
      () => {

        studyanteCloseProfileDropdown();
      }
    );


    document.addEventListener(
      "keydown",
      event => {

        if (event.key === "Escape") {

          studyanteCloseProfileDropdown();
        }
      }
    );


    studyanteSyncDropdownThemeText();
  }


  window.studyanteUpdateTopProfileMenu =
    studyanteUpdateTopProfileMenu;

  /* STUDYANTE_TOP_PROFILE_MENU_END */

  /* STUDYANTE_TOP_PROFILE_MENU_INIT_FIX_START */

  function initializeStudyanteTopProfileMenu() {

    installStudyanteAccountSettings();
    installStudyanteTopProfileMenu();

    if (
      studyanteCurrentUser &&
      typeof studyanteUpdateTopProfileMenu ===
      "function"
    ) {

      studyanteUpdateTopProfileMenu(
        studyanteCurrentUser
      );
    }
  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeStudyanteTopProfileMenu,
      { once: true }
    );

  } else {

    initializeStudyanteTopProfileMenu();
  }

  /* STUDYANTE_TOP_PROFILE_MENU_INIT_FIX_END */


})();

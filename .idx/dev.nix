{ pkgs, ... }: {
  channel = "stable-24.11";
  packages = [ pkgs.python3 pkgs.firebase-tools ];
  idx = {
    extensions = [ "google.gemini-cli-vscode-ide-companion" ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["python3" "-m" "http.server" "$PORT" "--directory" "public"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        default.openFiles = [ "public/index.html" "public/style.css" "public/script.js" ];
      };
      onStart = {};
    };
  };
}
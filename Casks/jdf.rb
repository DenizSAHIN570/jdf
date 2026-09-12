cask "jdf" do
  version "0.1.26"
  sha256 "1bde7cc74edbf7ec25e54b5a9d01c54e609ecceba052e9349788f56d9266ff8c"

  url "https://github.com/uurtech/jdf/releases/download/v#{version}/JDF.Reader_#{version}_aarch64.dmg"
  name "JDF Reader"
  desc "Viewer and editor for the JDF (JSON Document Format)"
  homepage "https://github.com/uurtech/jdf"

  depends_on arch: :arm64
  depends_on macos: :catalina

  app "JDF Reader.app"

  # The dmg is signed with a Developer ID cert and notarized by Apple, so it
  # passes Gatekeeper without any quarantine-stripping workaround.

  zap trash: [
    "~/Library/Application Support/dev.jdf.viewer",
    "~/Library/Caches/dev.jdf.viewer",
    "~/Library/Preferences/dev.jdf.viewer.plist",
    "~/Library/WebKit/dev.jdf.viewer",
  ]
end

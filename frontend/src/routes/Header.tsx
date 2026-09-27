import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";

export function Header() {
  return (
    <header className="h-[76px] bg-surface/70 border-b border-hairline flex items-center justify-end gap-2 px-8 shrink-0">
      <LanguageSwitcher />
      <ThemeSwitcher />
      <div className="w-px h-8 bg-hairline mx-2" />
      <UserMenu />
    </header>
  );
}

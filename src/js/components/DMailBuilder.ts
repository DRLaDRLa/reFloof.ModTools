import { PageDefinition } from "../models/data/Page";
import { TemplateBuilder, TemplateData } from "../models/structure/TemplateBuilder";
import { html } from "../utilities/HtmlTemplate";
import Component from "./Component";

// #region Type Stuff
interface LabeledButton extends TemplateData {
	/** Legacy field kept for backward compatibility with stored data. */
	label: string;
}

interface AtypicalButton extends TemplateData {
	/** Legacy field kept for backward compatibility with stored data. */
	text: string;
}

interface StoredButton extends AtypicalButton, LabeledButton {}

type Settings = {
  enabled: boolean;
  buttons: (AtypicalButton | LabeledButton | StoredButton | TemplateData)[];
  insertMode: "replace" | "insert";
  greeting: string;
};
// #endregion Type Stuff

const DEFAULT_GREETING = "Hi %recipientName%,\n\n";

export default class DMailBuilder extends Component {
  public Settings: Settings = {
    enabled: true,
    buttons: DMailBuilder.defaultTemplates,
    insertMode: "insert",
    greeting: DEFAULT_GREETING,
  };

  private builder?: TemplateBuilder;

  public constructor() {
    super({
      constraint: PageDefinition.dmails.new,
      waitForDOM: "form.new_dmail .dtext_formatter",
    });
  }

  public static get defaultTemplates(): TemplateData[] {
    return [];
  }

  private readonly settingsButtonLabel = "DMail Template Settings";
  protected create(): Promise<void> {
    this.initSettingsMenu();
    const target = document.querySelector<HTMLTextAreaElement>("form.new_dmail textarea[name='dmail[body]']");
    if (!target) return Promise.resolve();

    const scopedInsertMode = () => this.Settings.insertMode;
    this.builder = new TemplateBuilder({
      targetField: target,
      label: "DMail templates",
      get insertMode() { return scopedInsertMode(); },
      defaults: DMailBuilder.defaultTemplates,
      getTemplates: () => this.Settings.buttons.map((b) => ({
        title: b.title ?? b.label ?? "",
        body: b.body ?? b.text ?? "",
      } as TemplateData)),
      setTemplates: (next) => { this.Settings.buttons = next; },
      transform: (template) => {
        const greeting = this.Settings.greeting;
        const text = greeting.includes("%body%")
          ? greeting.replace("%body%", template.body)
          : `${greeting}${template.body}`;
        // This is empty on page load, so we load it on insertion instead
        const recipientName = (document.getElementById("dmail_to_name") as HTMLInputElement | undefined)?.value ?? "";
        return text.replace(/%recipientName%/g, recipientName);
      },
      pinnedChip: {
        title: "Greeting",
        getBody: () => this.Settings.greeting,
        setBody: (body) => { this.Settings.greeting = body; },
        defaultBody: DEFAULT_GREETING,
      },
    });
    this.builder.mount();
    return Promise.resolve();
  }

  protected async destroy(): Promise<void> {
    this.builder?.destroy();
  }

  private initSettingsMenu() {
    this.settingsMenuDialogParameters = {
      elements: [
        $(this.enabledElement),
        $(`<br />`),
        $(html`<fieldset title="How should the button's text be added to the text box?">
            <legend>Text insertion mode</legend>
            <label for="setting-insertMode-insert" title="Insert the text at the cursor position.">Insert <input type="radio" id="setting-insertMode-insert" name="setting-insertMode" value="insert"${(this.Settings.insertMode ?? "insert") === "insert" ? " checked" : ""} /></label>
            <label for="setting-insertMode-replace" title="Replace the entire contents of the text box.">Replace <input type="radio" id="setting-insertMode-replace" name="setting-insertMode" value="replace"${this.Settings.insertMode === "replace" ? " checked" : ""} /></label>
          </fieldset>` as HTMLFieldSetElement),
        $(`<br />`),
      ],
      optionsOrTitle: this.settingsButtonLabel,
      then: (e: FormData) => {
        if (!this.handleEnabledElement(e)) return;
        const v = e.get("setting-insertMode");
        if (v && (v === "insert" || v === "replace")) this.Settings.insertMode = v;
      },
    };
  }
}

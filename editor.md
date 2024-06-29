Editor integration
==================

If you use the `//autoimport` directive, the Choc Factory Importer can keep it
up-to-date for you. Integrate this with your editor as an automatic "run this
on save" script, or bind it to a hotkey, or include it in your build/test runs.

General / all editors
---------------------

Install the Chocolate Factory utilities using npm:

    npm install --global chocfactory

(If you are using this only for one project, you can omit the --global parameter)

The autoimporter can then be invoked on any file using this syntax:

    chocimport --fix /path/to/some/file.js

If your module exports functions which are called externally to return Chocolate
Factory elements, identify this to the importer thus:

    chocimport --fix --extcall=render_item --extcall=render_command /some/file.js

Any number of extcall directives can be given. You can also adorn individual
function definitions with "//extcall" at the end of the line; this has the same
effect, but can be used with any function, not just one at top level.

SciTE
-----

[SciTE, the Scintilla-based Text Editor](https://www.scintilla.org/SciTE.html),
can run the importer when you press (eg) Ctrl-1. Add the following to your
`.SciTEUser.properties` file (Options, Open User Options File):

    command.1.$(file.patterns.js)=chocimport --fix "$(FilePath)"
    command.name.1.$(file.patterns.js)=Choc Import check
    command.save.before.1.$(file.patterns.js)=1
    command.is.filter.1.$(file.patterns.js)=1

Visual Studio Code
------------------

Microsoft's VS Code, one of the world's most popular editors, can [bind any key
to run the importer](https://code.visualstudio.com/docs/editor/tasks#_binding-keyboard-shortcuts-to-tasks). Create a task (Configure, Tasks, Create tasks.json from
template) and add this inside the `"tasks"` array:

    {
        "label": "Choc Autoimport",
        "type": "shell",
        "command": "chocimport --fix \"${file}\""
    }

It is then available in the tasks menu, and can be assigned a keybinding, for
example (add this to keybindings.json):

    {
        "key": "ctrl+f1",
        "command": "workbench.action.tasks.runTask",
        "args": "Choc Autoimport",
        "when": "editorTextFocus"
    }

Other
-----

Many editors can be configured in this way. Feel free to submit a pull request
to add your favourite editor to this list!

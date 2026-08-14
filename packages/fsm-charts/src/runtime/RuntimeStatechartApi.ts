import type { StateChart } from "../types/index.js";

export type RuntimeListener = (id: string) => void;
export class RuntimeStatechartApi {
  element: HTMLElement;
  statechart: StateChart;
  _listenersCounter: number = 0;
  _transitionsClickListeners: Record<number, RuntimeListener> = {};
  _statesClickListeners: Record<number, RuntimeListener> = {};
  _registry: Record<number, () => void> = {};

  constructor({
    element,
    statechart,
  }: {
    element: HTMLElement;
    statechart: StateChart;
  }) {
    this.element = element;
    this.statechart = statechart;
    this._bindListeners();
  }

  close() {
    Object.values(this._registry).forEach((r) => r?.());
    this._registry = {};
    this._transitionsClickListeners = {};
    this._statesClickListeners = {};
  }

  onStateClick(listener: RuntimeListener) {
    return this._addListener(this._statesClickListeners, listener);
  }
  onTransitionClick(listener: RuntimeListener) {
    return this._addListener(this._transitionsClickListeners, listener);
  }

  openStatePanels() {
    this._setStatePanelStatus(`details[data-state-id]`, true);
  }
  closeStatePanels() {
    this._setStatePanelStatus(`details[data-state-id]`, false);
  }
  isStatePanelOpen(stateId: string) {
    const elm = this.element.querySelector(
      `details[data-state-id="${stateId}"]`,
    ) as HTMLDetailsElement;
    return elm && !!elm.open;
  }

  toggleState(...stateIds: string[]) {
    const lastId = stateIds[stateIds.length - 1];
    const selected = this.isStateSelected(lastId);
    this.deselectStates();
    this.closeStatePanels();
    this.activateStates(...stateIds);
    if (selected) {
      this.deselectState(lastId);
      this.closeStatePanel(lastId);
    }
    return !selected;
  }

  activateStates(...stateIds: string[]) {
    for (let i = 0; i < stateIds.length; i++) {
      const id = stateIds[i];
      this.openStatePanel(id);
      this.selectState(id);
    }
  }

  focusStates(...stateIds: string[]) {
    for (let i = 0; i < stateIds.length; i++) {
      const stateId = stateIds[i];
      for (const tagName of ["details", "g"]) {
        const elm = this.element.querySelector(
          `${tagName}[data-state-id="${stateId}"]`,
        );
        elm?.scrollIntoView();
      }
    }
  }

  setStateDescription(stateId: string, description: Node | string | undefined) {
    const descriptionContainer = this.element.querySelector(
      `details[data-state-id="${stateId}"] .state-details__description`,
    );
    if (descriptionContainer) {
      descriptionContainer.innerHTML = "";
      descriptionContainer.append(description ?? "");
    }
  }

  closeStatePanel(stateId: string) {
    this._setStatePanelStatus(`details[data-state-id="${stateId}"]`, false);
  }
  openStatePanel(stateId: string) {
    this._setStatePanelStatus(`details[data-state-id="${stateId}"]`, true);
  }

  deselectTransitions(modifier = "selected") {
    this._removeTransitionsModifier("[data-transition-id]", modifier);
  }
  deselectTransition(id: string, modifier: string = "selected") {
    this._removeTransitionsModifier(`[data-transition-id="${id}"]`, modifier);
  }
  selectTransition(id: string, modifier: string = "selected") {
    this._addTransitionsModifier(`[data-transition-id="${id}"]`, modifier);
  }
  toggleTransition(id: string, modifier: string = "selected") {
    const selected = this.isTransitionSelected(id, modifier);
    this.deselectTransitions();
    if (!selected) {
      this.selectTransition(id, modifier);
    }
    // if (!selected) this.deselectTransition(id, modifier);
    // else this.selectTransition(id, modifier);
  }
  isTransitionSelected(id: string, modifier: string = "selected") {
    const elm = this.element.querySelector(`[data-transition-id="${id}"]`);
    const stateModifier = `transition--${modifier}`;
    return !!elm?.classList.contains(stateModifier);
  }

  deselectStates(modifier: string = "selected") {
    this._removeStateModifier("[data-state-id]", modifier);
  }
  isStateSelected(id: string, modifier: string = "selected") {
    const elm = this.element.querySelector(`[data-state-id="${id}"]`);
    const stateModifier = `state--${modifier}`;
    return !!elm?.classList.contains(stateModifier);
  }
  deselectState(id: string, modifier: string = "selected") {
    this._removeStateModifier(`[data-state-id="${id}"]`, modifier);
  }
  selectState(id: string, modifier: string = "selected") {
    this._addStateModifier(`[data-state-id="${id}"]`, modifier);
  }

  // Internal methods

  _addListener<T = Function>(index: Record<string, T>, listener: T) {
    const id = this._listenersCounter++;
    index[id] = listener;
    return () => {
      delete index[id];
    };
  }

  _bindListeners() {
    const bindListeners = (
      index: Record<string, RuntimeListener>,
      dataField: string,
      eventType: string,
    ) => {
      function newEventListener(
        index: Record<string, RuntimeListener>,
        elm: Element,
      ) {
        return (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          let id: string | null | undefined = elm.getAttribute(dataField);
          if (!id) {
            id = elm.closest(`[${dataField}]`)?.getAttribute(dataField);
          }
          if (id) {
            for (const listener of Object.values(index)) {
              listener(id);
            }
          }
        };
      }
      [...this.element.querySelectorAll(`[${dataField}]`)].forEach((elm) => {
        const eventListener = newEventListener(index, elm);
        elm.addEventListener(eventType, eventListener);
        this._addListener(this._registry, () =>
          elm.removeEventListener(eventType, eventListener),
        );
      });
    };
    bindListeners(this._statesClickListeners, "data-state-id", "click");
    bindListeners(
      this._transitionsClickListeners,
      "data-transition-id",
      "click",
    );
  }

  _setStatePanelStatus(selector: string, open: boolean) {
    [...this.element.querySelectorAll(selector)].forEach((elm) => {
      if (open) elm.setAttribute("open", "open");
      else elm.removeAttribute("open");
    });
  }

  _addStateModifier(cssSelector: string, modifier: string = "selected") {
    this._applyStateModifier(cssSelector, modifier, (elm, cls) =>
      elm?.classList.add(cls),
    );
  }
  _removeStateModifier(cssSelector: string, modifier: string = "selected") {
    this._applyStateModifier(cssSelector, modifier, (elm, cls) =>
      elm?.classList.remove(cls),
    );
  }
  _applyStateModifier(
    cssSelector: string,
    modifier: string = "selected",
    apply: (elm: Element | null, className: string) => void,
  ) {
    const detailsModifier = `state-details--${modifier}`;
    const stateLabelsModifier = `state-details__label--${modifier}`;
    const stateModifier = `state--${modifier}`;
    [...this.element.querySelectorAll(cssSelector)].forEach((elm) => {
      if (elm.tagName.toLowerCase() === "details") {
        apply(elm, detailsModifier);
        const labelElm = elm.querySelector(".state-details__label");
        if (labelElm) apply(labelElm, stateLabelsModifier);
      } else {
        apply(elm, stateModifier);
      }
    });
  }

  _addTransitionsModifier(cssSelector: string, modifier: string = "selected") {
    this._applyTransitionsModifier(cssSelector, modifier, (elm, cls) =>
      elm?.classList.add(cls),
    );
  }
  _removeTransitionsModifier(
    cssSelector: string,
    modifier: string = "selected",
  ) {
    this._applyTransitionsModifier(cssSelector, modifier, (elm, cls) =>
      elm?.classList.remove(cls),
    );
  }
  _applyTransitionsModifier(
    cssSelector: string,
    modifier: string = "selected",
    apply: (elm: Element | null, className: string) => void,
  ) {
    const transitionModifier = `transition--${modifier}`;
    const transitionLineModifier = `transition__line--${modifier}`;
    const transitionBoxModifier = `transition__box--${modifier}`;
    const transitionLabelModifier = `transition__label--${modifier}`;
    [...this.element.querySelectorAll(cssSelector)].forEach((elm) => {
      apply(elm, transitionModifier);
      apply(elm.querySelector(".transition__line"), transitionLineModifier);
      apply(elm.querySelector(".transition__box"), transitionBoxModifier);
      apply(elm.querySelector(".transition__label"), transitionLabelModifier);
    });
  }
}

import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";

/**
 * @namespace base.controller
 */
export default class Main extends Controller {
  public override onInit(): void {}

  public onNavToDetail(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteTongQuan");
  }

  public onNavToDetail1(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep01");
  }

  public onNavToDetail2(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep02");
  }

  public onNavToDetail3(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep03");
  }

  public onNavToDetail4(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep04");
  }

  public onNavToDetail5(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep05");
  }

  public onNavToDetail6(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep06");
  }

  public onNavToDetail7(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep07");
  }

  public onNavToDetail8(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep08");
  }

  public onNavToDetail9(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep09");
  }

  public onNavToDetail10(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep10");
  }

  public onNavToDetail11(): void {
    const oRouter = UIComponent.getRouterFor(this);
    oRouter.navTo("RouteStep11");
  }
}

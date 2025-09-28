import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import type ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import type ResourceModel from "sap/ui/model/resource/ResourceModel";

export default class Step02 extends Controller {
  public override onInit(): void {
    let oData = {
      busy: false,
    };
    let oModel = new JSONModel(oData);
    this.getView()?.setModel(oModel, "appView");
  }

  public onNavBack(): void {
    const history = History.getInstance();
    const previousHash = history.getPreviousHash();

    if (previousHash !== undefined) {
      window.history.go(-1);
    } else {
      const router = UIComponent.getRouterFor(this);
      router.navTo("RouteMain", {}, true);
    }
  }

  public async onRefresh(): Promise<void> {
    // Lấy OData model từ view
    const model = this.getView()?.getModel() as ODataModel;

    // Nếu không tìm thấy model → hiển thị lỗi
    if (!model) {
      MessageBox.error("OData model not found");
      return;
    }

    // Kiểm tra xem có pending changes hay không (có dữ liệu chưa lưu)
    // hasPendingChanges là một hàm của ODataModel
    if (model.hasPendingChanges && model.hasPendingChanges()) {
      // Lấy thông điệp lỗi từ i18n (async vì getResourceBundle trả Promise)
      const msg = await this._getText("refreshNotPossibleMessage");
      // Hiển thị hộp thoại lỗi
      MessageBox.error(msg);
      return;
    }

    // Lấy binding của Table theo id 'peopleList' và path 'items'
    const binding = this.byId("peopleList")?.getBinding("items") as ODataListBinding;

    // Nếu không tìm thấy binding → hiển thị lỗi
    if (!binding) {
      const msg = await this._getText("refreshNotPossibleMessage");
      MessageBox.error(msg);
      return;
    }

    // Refresh dữ liệu từ OData service
    binding.refresh();

    // Lấy thông điệp thành công từ i18n
    const successMsg = await this._getText("refreshSuccessMessage");
    // Hiển thị thông báo thành công
    MessageToast.show(successMsg);
  }

  // Helper async để lấy text từ i18n (có thể hỗ trợ đa ngôn ngữ)
  private async _getText(sTextId: string, aArgs?: any[]): Promise<string> {
    // Lấy ResourceModel i18n từ Component
    const oModel = this.getOwnerComponent()?.getModel("i18n") as ResourceModel;

    // Nếu không tìm thấy model → trả fallback là chính sTextId
    if (!oModel) {
      return sTextId;
    }

    try {
      // getResourceBundle trả về Promise<ResourceBundle>
      const oBundle = await oModel.getResourceBundle();

      // Lấy text từ bundle, nếu undefined thì fallback về sTextId
      return oBundle?.getText(sTextId, aArgs) ?? sTextId;
    } catch (err) {
      // Nếu có lỗi khi lấy bundle → fallback
      return sTextId;
    }
  }
}

// onRefresh được async để có thể await _getText.
// Kiểm tra model và binding trước khi gọi các method để tránh TS lỗi possibly undefined.
// _getText luôn trả về string (fallback sTextId) nếu bundle chưa load hoặc bị lỗi.
// Loại bỏ duplicate binding.refresh() và MessageToast.show().

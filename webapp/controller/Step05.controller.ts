import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import type ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import type ResourceModel from "sap/ui/model/resource/ResourceModel";
import type Event from "sap/ui/base/Event";
import type Input from "sap/m/Input";
import { ValueState } from "sap/ui/core/library";
import Filter from "sap/ui/model/Filter";
import Sorter from "sap/ui/model/Sorter";
import FilterOperator from "sap/ui/model/FilterOperator";
import FilterType from "sap/ui/model/FilterType";
import type ListBinding from "sap/ui/model/ListBinding";

export default class Step05 extends Controller {
  public override onInit(): void {
    let oData = {
      busy: false,
      order: 0,
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

  public onAgeChange(event: Event): void {
    // Lấy đối tượng Input mà người dùng vừa thay đổi từ event
    const input = event.getSource() as Input;

    // Lấy giá trị hiện tại của Input dưới dạng chuỗi
    const value = input.getValue(); // V2 không có event.getParameter("valid"), phải validate thủ công

    // Kiểm tra xem giá trị có phải là số nguyên dương hay không
    // Biểu thức /^\d+$/ sẽ chỉ match các chuỗi chỉ chứa chữ số 0-9 (không âm, không thập phân)
    if (!/^\d+$/.test(value)) {
      // Nếu không hợp lệ, hiển thị hộp thoại lỗi
      MessageBox.error("Age phải là số nguyên >= 0");

      // Đánh dấu trạng thái của Input là Error (màu đỏ, hiển thị lỗi)
      input.setValueState(ValueState.Error);

      // Thiết lập text hiển thị khi hover vào Input báo lỗi
      input.setValueStateText("Age phải là số nguyên >= 0");
    } else {
      // Nếu hợp lệ, xóa trạng thái lỗi, hiển thị bình thường
      input.setValueState(ValueState.None);
    }
  }

  // Hàm tìm kiếm theo LastName
  public onSearch(): void {
    // Lấy View hiện tại của Controller
    const view = this.getView();

    // Lấy control Input theo ID "searchField" và ép kiểu Input cho TypeScript
    const input = view?.byId("searchField") as Input | undefined;

    // Lấy giá trị người dùng nhập vào ô tìm kiếm, fallback là chuỗi rỗng nếu input undefined
    const value = input?.getValue() ?? "";

    // Tạo filter: tìm các bản ghi có LastName chứa giá trị nhập
    const filter = new Filter("LastName", FilterOperator.Contains, value);

    // Lấy binding của Table (sap.m.Table) theo ID "peopleList"
    const binding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại thì áp dụng filter ở mức ứng dụng
    if (binding) {
      binding.filter([filter], FilterType.Application);
    }
  }

  // Hàm sắp xếp LastName với trạng thái xoay vòng: none -> asc -> desc
  public async onSort(): Promise<void> {
    // Lấy View hiện tại
    const view = this.getView();

    // Mảng trạng thái sắp xếp: undefined = không sắp xếp, "asc" = tăng dần, "desc" = giảm dần
    const states: Array<undefined | "asc" | "desc"> = [undefined, "asc", "desc"];

    // Mảng key i18n tương ứng để hiển thị thông báo
    const aStateTextIds = ["sortNone", "sortAscending", "sortDescending"];

    // Lấy trạng thái hiện tại từ JSONModel appView
    const iOrder = (view?.getModel("appView")?.getProperty("/order") as number) ?? 0;

    // Tính trạng thái tiếp theo theo vòng lặp
    const iNextOrder = (iOrder + 1) % states.length;

    // Lấy trạng thái tiếp theo
    const sOrder = states[iNextOrder];

    // Lấy JSONModel của appView và cập nhật trạng thái order
    const oAppViewModel = view?.getModel("appView") as JSONModel | undefined;
    oAppViewModel?.setProperty("/order", iNextOrder);

    // Lấy binding của Table "peopleList"
    const oBinding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại, áp dụng sắp xếp theo LastName
    if (oBinding) {
      oBinding.sort(sOrder ? [new Sorter("LastName", sOrder === "desc")] : []);
    }

    // Chuỗi hiển thị trong thông báo (ví dụ tên cột LastName)
    const sLastName = "LastName";

    // Lấy i18n ResourceModel
    const oI18nModel = view?.getModel("i18n") as ResourceModel | undefined;

    // Khởi tạo message rỗng
    let sMessage = "";

    // Nếu model i18n tồn tại, lấy ResourceBundle và lấy text thông báo theo trạng thái
    if (oI18nModel) {
      const oBundle = await oI18nModel.getResourceBundle(); // Promise vì async
      sMessage = oBundle.getText(aStateTextIds[iNextOrder], [sLastName]) ?? "";
    }

    // Hiển thị thông báo toast
    MessageToast.show(sMessage);
  }
}

// onRefresh được async để có thể await _getText.
// Kiểm tra model và binding trước khi gọi các method để tránh TS lỗi possibly undefined.
// _getText luôn trả về string (fallback sTextId) nếu bundle chưa load hoặc bị lỗi.
// Loại bỏ duplicate binding.refresh() và MessageToast.show().
